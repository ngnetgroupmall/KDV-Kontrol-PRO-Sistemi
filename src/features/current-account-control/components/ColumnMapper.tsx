import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';

interface ColumnMapperProps {
    file: File;
    type: 'smmm' | 'firma';
    onMappingComplete: (mapping: Record<string, string>) => void;
    onCancel: () => void;
}

const MAPPING_FIELDS = [
    { key: 'code', label: 'Hesap Kodu', required: true },
    { key: 'name', label: 'Hesap Adi', required: true },
    { key: 'date', label: 'Tarih', required: true },
    { key: 'desc', label: 'Aciklama', required: false },
    { key: 'debit', label: 'Borc', required: true },
    { key: 'credit', label: 'Alacak', required: true },
    { key: 'voucher', label: 'Evrak No', required: false },
];

const normalizeHeader = (value: string): string => {
    return value
        .toLocaleLowerCase('tr-TR')
        .replace(/ı/g, 'i')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

const detectHeaderRowIndex = (rows: any[][]): number => {
    let bestIndex = 0;
    let bestScore = -1;
    const keywords = ['hesap', 'kod', 'ad', 'tarih', 'aciklama', 'borc', 'alacak', 'evrak', 'fis'];

    for (let i = 0; i < Math.min(rows.length, 25); i += 1) {
        const row = rows[i] || [];
        const normalizedCells = row.map((cell) => normalizeHeader(String(cell ?? '')));
        let score = 0;

        normalizedCells.forEach((cell) => {
            if (keywords.some((keyword) => cell.includes(keyword))) {
                score += 1;
            }
        });

        if (score > bestScore) {
            bestScore = score;
            bestIndex = i;
        }
    }

    return bestIndex;
};

export default function ColumnMapper({ file, type, onMappingComplete, onCancel }: ColumnMapperProps) {
    const [headers, setHeaders] = useState<string[]>([]);
    const [previewData, setPreviewData] = useState<any[][]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [headerRowIndex, setHeaderRowIndex] = useState(0);

    useEffect(() => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as any[][];

                if (!rows.length) {
                    throw new Error('Excel dosyasi bos veya okunamadi.');
                }

                const detected = detectHeaderRowIndex(rows);
                const detectedHeaders = (rows[detected] || []).map((cell) => String(cell ?? '').trim());

                setHeaderRowIndex(detected);
                setHeaders(detectedHeaders);
                setPreviewData(rows.slice(detected + 1, detected + 6));

                const autoMapping: Record<string, string> = {};
                detectedHeaders.forEach((header, idx) => {
                    const normalized = normalizeHeader(header);
                    if (normalized.includes('hesap kodu') || normalized === 'kod') autoMapping.code = String(idx);
                    else if (normalized.includes('hesap adi') || normalized.includes('hesap unvani')) autoMapping.name = String(idx);
                    else if (normalized.includes('tarih')) autoMapping.date = String(idx);
                    else if (normalized.includes('aciklama')) autoMapping.desc = String(idx);
                    else if (normalized.includes('borc')) autoMapping.debit = String(idx);
                    else if (normalized.includes('alacak')) autoMapping.credit = String(idx);
                    else if (normalized.includes('evrak') || normalized.includes('fis')) autoMapping.voucher = String(idx);
                });

                setMapping(autoMapping);
                setLoading(false);
            } catch (error) {
                console.error('Error reading excel file:', error);
                alert('Dosya okunamadi. Lutfen gecerli bir Excel dosyasi secin.');
                onCancel();
            }
        };
        reader.onerror = (error) => {
            console.error('FileReader error:', error);
            alert('Dosya okuma hatasi.');
            onCancel();
        };
        reader.readAsArrayBuffer(file);
    }, [file, onCancel]);

    if (loading) {
        return <div className="text-white">Dosya okunuyor...</div>;
    }

    const handleConfirm = () => {
        const missing = MAPPING_FIELDS.filter((field) => field.required && !mapping[field.key]);
        if (missing.length > 0) {
            alert(`Lutfen zorunlu alanlari eslestirin: ${missing.map((item) => item.label).join(', ')}`);
            return;
        }

        onMappingComplete({
            ...mapping,
            __headerRow: String(headerRowIndex),
        });
    };

    return (
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">
                {type === 'smmm' ? 'SMMM' : 'Firma'} Dosyasi Sutun Eslestirme
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    {MAPPING_FIELDS.map((field) => (
                        <div key={field.key} className="flex justify-between items-center">
                            <label className="text-slate-300 w-1/3">
                                {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            <select
                                className="w-2/3 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                                value={mapping[field.key] || ''}
                                onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                            >
                                <option value="">Seciniz...</option>
                                {headers.map((header, idx) => (
                                    <option key={`${header}-${idx}`} value={String(idx)}>
                                        {header || `Sutun ${idx + 1}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>

                <div className="overflow-auto border border-slate-700 rounded-lg max-h-[400px]">
                    <table className="w-full text-sm text-slate-300">
                        <thead className="bg-slate-900 sticky top-0">
                            <tr>
                                {headers.map((header, index) => (
                                    <th key={`${header}-${index}`} className="p-2 text-left border-b border-slate-700 whitespace-nowrap">
                                        {header || `Sutun ${index + 1}`}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {previewData.map((row, rowIndex) => (
                                <tr key={rowIndex} className="border-b border-slate-800/50">
                                    {headers.map((_, columnIndex) => (
                                        <td key={columnIndex} className="p-2 whitespace-nowrap">
                                            {row[columnIndex]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex justify-end gap-4 mt-6">
                <button onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">
                    Iptal
                </button>
                <button
                    onClick={handleConfirm}
                    className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                    Onayla ve Devam Et
                </button>
            </div>
        </div>
    );
}
