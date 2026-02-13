import * as XLSX from 'xlsx';
import { parseTurkishNumber } from '../../../utils/parsers';
import type { AccountDetail, Transaction } from '../../common/types';

const TARGET_PREFIXES = new Set(['120', '320', '159', '340', '336']);

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const parseIndex = (value: string | undefined): number | null => {
    if (value === undefined) return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) return null;
    return parsed;
};

const normalizeAccountCode = (value: any): string => String(value ?? '').trim().replace(/\s+/g, '');

const getAccountPrefix = (accountCode: string): string => accountCode.replace(/\D/g, '').slice(0, 3);

const isTargetAccount = (accountCode: string): boolean => TARGET_PREFIXES.has(getAccountPrefix(accountCode));

const parseDate = (value: any): Date | null => {
    if (value === null || value === undefined || value === '') return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
    }

    if (typeof value === 'number') {
        const date = new Date(Math.round((value - 25569) * 86400 * 1000));
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const raw = String(value).trim();
    if (!raw) return null;

    const ddMmYyyy = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (ddMmYyyy) {
        const year = ddMmYyyy[3].length === 2 ? Number(`20${ddMmYyyy[3]}`) : Number(ddMmYyyy[3]);
        const month = Number(ddMmYyyy[2]) - 1;
        const day = Number(ddMmYyyy[1]);
        const date = new Date(year, month, day);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const shouldSkipByName = (name: string): boolean => {
    const normalized = name.toLocaleUpperCase('tr-TR');
    return (
        normalized.includes('TOPLAM') ||
        normalized.includes('YEKUN') ||
        normalized.includes('NAKLI') ||
        normalized.includes('DEVIR')
    );
};

const getCell = (row: any[], index: number | null): any => {
    if (index === null || index < 0 || index >= row.length) return null;
    return row[index];
};

export const parseExcelData = async (
    file: File,
    mapping: Record<string, string>,
    options?: { includeAllAccounts?: boolean }
): Promise<AccountDetail[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(worksheet, {
                    header: 1,
                    raw: true,
                    defval: null,
                }) as any[][];

                const headerRowIndex = parseIndex(mapping.__headerRow) ?? 0;
                const dataRows = rows.slice(headerRowIndex + 1);

                const codeIndex = parseIndex(mapping.code);
                const nameIndex = parseIndex(mapping.name);
                const dateIndex = parseIndex(mapping.date);
                const descIndex = parseIndex(mapping.desc);
                const debitIndex = parseIndex(mapping.debit);
                const creditIndex = parseIndex(mapping.credit);
                const voucherIndex = parseIndex(mapping.voucher);
                const includeAllAccounts = options?.includeAllAccounts ?? false;

                if (codeIndex === null || nameIndex === null || dateIndex === null || debitIndex === null || creditIndex === null) {
                    reject(new Error('Zorunlu alanlar eksik. Lutfen sutun eslestirmesini kontrol edin.'));
                    return;
                }

                const accountMap = new Map<string, AccountDetail>();

                dataRows.forEach((row) => {
                    if (!row || !Array.isArray(row)) return;

                    const code = normalizeAccountCode(getCell(row, codeIndex));
                    if (!code) return;
                    if (!includeAllAccounts && !isTargetAccount(code)) return;

                    const name = String(getCell(row, nameIndex) ?? '').trim();
                    if (!name || shouldSkipByName(name)) return;

                    const debit = round2(parseTurkishNumber(getCell(row, debitIndex)));
                    const credit = round2(parseTurkishNumber(getCell(row, creditIndex)));
                    const hasMovement = debit !== 0 || credit !== 0;

                    const key = code;
                    if (!accountMap.has(key)) {
                        accountMap.set(key, {
                            code,
                            name,
                            totalDebit: 0,
                            totalCredit: 0,
                            balance: 0,
                            transactionCount: 0,
                            transactions: [],
                        });
                    }

                    const account = accountMap.get(key)!;
                    if (!account.name && name) {
                        account.name = name;
                    }

                    if (hasMovement) {
                        account.totalDebit = round2(account.totalDebit + debit);
                        account.totalCredit = round2(account.totalCredit + credit);
                        account.transactionCount += 1;

                        const transaction: Transaction = {
                            date: parseDate(getCell(row, dateIndex)),
                            description: String(getCell(row, descIndex) ?? '').trim(),
                            debit,
                            credit,
                            voucherNo: voucherIndex === null ? undefined : String(getCell(row, voucherIndex) ?? '').trim() || undefined,
                        };
                        account.transactions.push(transaction);
                    }
                });

                const accounts = Array.from(accountMap.values()).map((account) => {
                    account.transactions.sort((a, b) => {
                        const at = a.date ? a.date.getTime() : Number.MAX_SAFE_INTEGER;
                        const bt = b.date ? b.date.getTime() : Number.MAX_SAFE_INTEGER;
                        return at - bt;
                    });

                    let runningBalance = 0;
                    account.transactions.forEach((transaction) => {
                        runningBalance = round2(runningBalance + transaction.debit - transaction.credit);
                        transaction.balance = runningBalance;
                    });

                    account.totalDebit = round2(account.totalDebit);
                    account.totalCredit = round2(account.totalCredit);
                    account.balance = round2(account.totalDebit - account.totalCredit);
                    return account;
                });

                accounts.sort((a, b) => {
                    const codeCompare = a.code.localeCompare(b.code, 'tr-TR');
                    if (codeCompare !== 0) return codeCompare;
                    return a.name.localeCompare(b.name, 'tr-TR');
                });

                resolve(accounts);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};
