import * as XLSX from 'xlsx';

interface CellStyle {
    font?: { bold?: boolean; color?: { rgb?: string }; sz?: number; name?: string };
    fill?: { fgColor?: { rgb?: string }; patternType?: string };
    border?: {
        top?: { style: string; color?: { rgb?: string } };
        bottom?: { style: string; color?: { rgb?: string } };
        left?: { style: string; color?: { rgb?: string } };
        right?: { style: string; color?: { rgb?: string } };
    };
    alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean };
    numFmt?: string;
}

export interface StyledSheetOptions {
    headerRowIndex?: number;
    numericColumns?: number[];
    minColWidth?: number;
    maxColWidth?: number;
}

const THIN_BORDER = { style: 'thin', color: { rgb: '000000' } };

const ALL_BORDERS = {
    top: THIN_BORDER,
    bottom: THIN_BORDER,
    left: THIN_BORDER,
    right: THIN_BORDER,
};

const HEADER_STYLE: CellStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' },
    fill: { fgColor: { rgb: '1E3A5F' }, patternType: 'solid' },
    border: ALL_BORDERS,
    alignment: { horizontal: 'center', vertical: 'center' },
};

const DATA_STYLE: CellStyle = {
    font: { sz: 11, name: 'Calibri' },
    border: ALL_BORDERS,
    alignment: { vertical: 'center' },
};

const NUMBER_FORMAT = '#,##0.00';
const TR_NUMBER_FORMATTER = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const normalizeNumericString = (raw: string): string => {
    let value = String(raw || '').trim();
    if (!value) return '';

    let isNegative = false;
    if (value.startsWith('(') && value.endsWith(')')) {
        isNegative = true;
        value = value.slice(1, -1);
    }

    value = value
        .replace(/\s+/g, '')
        .replace(/[\u20BA\u0024\u20AC\u00A3]/g, '');

    if (value.includes(',') && value.includes('.')) {
        if (value.lastIndexOf(',') > value.lastIndexOf('.')) {
            value = value.replace(/\./g, '').replace(/,/g, '.');
        } else {
            value = value.replace(/,/g, '');
        }
    } else if (value.includes(',')) {
        const parts = value.split(',');
        if (parts.length === 2 && parts[1].length <= 2) {
            value = `${parts[0].replace(/\./g, '')}.${parts[1]}`;
        } else {
            value = value.replace(/,/g, '');
        }
    } else {
        value = value.replace(/,/g, '');
    }

    value = value.replace(/[^0-9.-]/g, '');
    if (isNegative && value && !value.startsWith('-')) {
        value = `-${value}`;
    }
    return value;
};

const toNumericValue = (value: unknown): number | null => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== 'string') return null;
    const normalized = normalizeNumericString(value);
    if (!normalized) return null;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};

const getCellTextLength = (value: unknown, preferNumeric = false): number => {
    if (value === null || value === undefined) return 0;

    if (preferNumeric) {
        const parsed = toNumericValue(value);
        if (parsed !== null) {
            return TR_NUMBER_FORMATTER.format(parsed).length;
        }
    }

    return String(value).length;
};

export function applyStyledSheet(
    ws: XLSX.WorkSheet,
    options: StyledSheetOptions = {}
): void {
    const {
        headerRowIndex = 0,
        numericColumns = [],
        minColWidth = 10,
        maxColWidth = 60,
    } = options;

    const sheetRef = ws['!ref'];
    if (!sheetRef) return;

    const range = XLSX.utils.decode_range(sheetRef);
    const numericSet = new Set(numericColumns);
    const colMaxLen: number[] = [];

    for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = ws[cellRef];
            if (!cell) continue;

            const isNumeric = row > headerRowIndex && numericSet.has(col);
            if (isNumeric) {
                const parsed = toNumericValue(cell.v);
                if (parsed !== null) {
                    cell.v = parsed;
                    cell.t = 'n';
                    cell.z = NUMBER_FORMAT;
                }
            }

            const textLen = getCellTextLength(cell.v, isNumeric);
            if (colMaxLen[col] === undefined || textLen > colMaxLen[col]) {
                colMaxLen[col] = textLen;
            }

            if (row === headerRowIndex) {
                cell.s = { ...HEADER_STYLE };
            } else if (row > headerRowIndex) {
                cell.s = {
                    ...DATA_STYLE,
                    ...(isNumeric
                        ? { numFmt: NUMBER_FORMAT, alignment: { ...DATA_STYLE.alignment, horizontal: 'right' } }
                        : {}),
                };
            }
        }
    }

    if (!ws['!cols']) {
        ws['!cols'] = [];
    }
    for (let col = range.s.c; col <= range.e.c; col++) {
        const contentWidth = (colMaxLen[col] || 0) + 3;
        ws['!cols'][col] = { wch: Math.min(maxColWidth, Math.max(minColWidth, contentWidth)) };
    }

    if (headerRowIndex >= range.s.r && headerRowIndex <= range.e.r) {
        ws['!autofilter'] = {
            ref: XLSX.utils.encode_range({
                s: { r: headerRowIndex, c: range.s.c },
                e: { r: headerRowIndex, c: range.e.c },
            }),
        };
    }

    if (!ws['!views']) ws['!views'] = [];
    ws['!views'][0] = { state: 'frozen', ySplit: headerRowIndex + 1 };
}

export function createStyledWorkbook(
    data: Record<string, unknown>[],
    sheetName: string,
    numericColumns: number[] = []
): XLSX.WorkBook {
    const ws = XLSX.utils.json_to_sheet(data);
    applyStyledSheet(ws, { headerRowIndex: 0, numericColumns });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return wb;
}
