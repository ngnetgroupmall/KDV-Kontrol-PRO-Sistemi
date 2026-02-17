import { parseTurkishNumber } from '../../utils/parsers';
import type {
    AccountDetail,
    Transaction,
    VoucherEditLogEntry,
    VoucherEditSource,
} from './types';

export const CURRENT_ACCOUNT_SCOPE_PREFIXES = new Set(['120', '320', '159', '329', '340', '336']);

export type VoucherEditField =
    | 'date'
    | 'account'
    | 'documentNo'
    | 'description'
    | 'debit'
    | 'credit'
    | 'currencyCode'
    | 'exchangeRate'
    | 'fxMovement'
    | 'fxBalance';

export interface VoucherEditLocator {
    source: VoucherEditSource;
    accountCode: string;
    transactionIndex: number;
    transactionId?: string;
    voucherNo?: string;
}

export interface VoucherEditRequest {
    locator: VoucherEditLocator;
    field: VoucherEditField;
    value: string;
    targetAccountCode?: string;
    targetAccountName?: string;
}

export interface VoucherAddRowRequest {
    source: VoucherEditSource;
    voucherNo: string;
    accountCode: string;
    accountName?: string;
    date: string;
    documentNo?: string;
    description?: string;
    debit: string;
    credit: string;
    currencyCode?: string;
    exchangeRate?: string;
    fxMovement?: string;
    fxBalance?: string;
}

export interface VoucherMutationResult {
    changed: boolean;
    accounts: AccountDetail[];
    logEntry?: VoucherEditLogEntry;
    error?: string;
    focusVoucherNo?: string;
}

export interface VoucherBatchMutationResult {
    changed: boolean;
    accounts: AccountDetail[];
    logEntries: VoucherEditLogEntry[];
    error?: string;
    focusVoucherNo?: string;
}

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const round4 = (value: number): number => Math.round((value + Number.EPSILON) * 10000) / 10000;

const normalizeCurrencyCode = (value: string | undefined): string => {
    return String(value || '').trim().toLocaleUpperCase('tr-TR');
};

const isTlCurrencyCode = (value: string | undefined): boolean => {
    const normalized = normalizeCurrencyCode(value);
    if (!normalized) return false;
    return normalized === 'TL' || normalized.includes('TRY');
};

const normalizeAccountCode = (value: string | undefined): string => {
    return String(value || '').trim().replace(/\s+/g, '');
};

const normalizeVoucherNo = (value: string | undefined): string => {
    return String(value || '').trim().replace(/\s+/g, '').toLocaleUpperCase('tr-TR');
};

const buildTransactionId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const parseDateInput = (value: string): { value: Date | null; error?: string } => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return { value: null };

    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
        const year = Number(isoMatch[1]);
        const month = Number(isoMatch[2]) - 1;
        const day = Number(isoMatch[3]);
        const date = new Date(year, month, day);
        return Number.isNaN(date.getTime())
            ? { value: null, error: 'Gecersiz tarih.' }
            : { value: date };
    }

    const trMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (trMatch) {
        const year = trMatch[3].length === 2 ? Number(`20${trMatch[3]}`) : Number(trMatch[3]);
        const month = Number(trMatch[2]) - 1;
        const day = Number(trMatch[1]);
        const date = new Date(year, month, day);
        return Number.isNaN(date.getTime())
            ? { value: null, error: 'Gecersiz tarih.' }
            : { value: date };
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime())
        ? { value: null, error: 'Tarih formati anlasilamadi.' }
        : { value: parsed };
};

const parseRequiredNumber = (
    value: string,
    label: string,
    decimals: 2 | 4 = 2
): { value?: number; error?: string } => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return { value: 0 };
    const parsed = parseTurkishNumber(trimmed);
    if (!Number.isFinite(parsed)) return { error: `${label} gecerli bir sayi olmali.` };
    return { value: decimals === 2 ? round2(parsed) : round4(parsed) };
};

const parseOptionalNumber = (
    value: string | undefined,
    label: string,
    decimals: 2 | 4 = 4
): { value?: number; error?: string } => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return { value: undefined };
    const parsed = parseTurkishNumber(trimmed);
    if (!Number.isFinite(parsed)) return { error: `${label} gecerli bir sayi olmali.` };
    return { value: decimals === 2 ? round2(parsed) : round4(parsed) };
};

const formatDateForLog = (value: Date | null | undefined): string => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
    return value.toLocaleDateString('tr-TR');
};

const formatNumberForLog = (value: number | undefined): string => {
    if (typeof value !== 'number') return '';
    return new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    }).format(value);
};

const getFieldLabel = (field: VoucherEditField): string => {
    switch (field) {
        case 'date':
            return 'Tarih';
        case 'account':
            return 'Hesap';
        case 'documentNo':
            return 'Evrak No';
        case 'description':
            return 'Aciklama';
        case 'debit':
            return 'Borc';
        case 'credit':
            return 'Alacak';
        case 'currencyCode':
            return 'Doviz Turu';
        case 'exchangeRate':
            return 'Kur';
        case 'fxMovement':
            return 'Doviz Hareket';
        case 'fxBalance':
            return 'Doviz Bakiye';
        default:
            return field;
    }
};

const getFieldLogValue = (
    field: VoucherEditField,
    transaction: Transaction,
    account: AccountDetail
): string => {
    switch (field) {
        case 'date':
            return formatDateForLog(transaction.date);
        case 'account':
            return `${account.code} - ${account.name || ''}`.trim();
        case 'documentNo':
            return String(transaction.documentNo || '');
        case 'description':
            return String(transaction.description || '');
        case 'debit':
            return formatNumberForLog(transaction.debit);
        case 'credit':
            return formatNumberForLog(transaction.credit);
        case 'currencyCode':
            return String(transaction.currencyCode || '');
        case 'exchangeRate':
            return formatNumberForLog(transaction.exchangeRate);
        case 'fxMovement': {
            const movement = (transaction.fxDebit || 0) - (transaction.fxCredit || 0);
            return Math.abs(movement) < 0.0001 ? '' : formatNumberForLog(movement);
        }
        case 'fxBalance':
            return formatNumberForLog(transaction.fxBalance);
        default:
            return '';
    }
};

const cloneTransaction = (transaction: Transaction): Transaction => ({
    ...transaction,
    id: transaction.id || buildTransactionId(),
    date: transaction.date ? new Date(transaction.date) : null,
});

const cloneAccount = (account: AccountDetail): AccountDetail => ({
    ...account,
    transactions: (account.transactions || []).map(cloneTransaction),
});

const createMutableAccounts = (accounts: AccountDetail[]) => {
    const nextAccounts = (accounts || []).slice();
    const mutableAccounts = new Set<AccountDetail>();

    const ensureMutableAccountAt = (index: number): AccountDetail | null => {
        const current = nextAccounts[index];
        if (!current) return null;
        if (mutableAccounts.has(current)) return current;

        const cloned = cloneAccount(current);
        nextAccounts[index] = cloned;
        mutableAccounts.add(cloned);
        return cloned;
    };

    const markAsMutable = (account: AccountDetail) => {
        mutableAccounts.add(account);
    };

    return {
        nextAccounts,
        ensureMutableAccountAt,
        markAsMutable,
    };
};

const recalcAccount = (account: AccountDetail): AccountDetail => {
    const sortable = account.transactions.map((transaction, index) => ({
        transaction,
        originalIndex: index,
    }));

    sortable.sort((left, right) => {
        const leftTime = left.transaction.date ? left.transaction.date.getTime() : Number.MAX_SAFE_INTEGER;
        const rightTime = right.transaction.date ? right.transaction.date.getTime() : Number.MAX_SAFE_INTEGER;
        if (leftTime !== rightTime) return leftTime - rightTime;
        return left.originalIndex - right.originalIndex;
    });

    account.transactions = sortable.map((item) => item.transaction);

    let totalDebit = 0;
    let totalCredit = 0;
    let runningBalance = 0;
    const fxRunningByCurrency = new Map<string, number>();

    account.transactions.forEach((transaction) => {
        const debit = round2(Number(transaction.debit || 0));
        const credit = round2(Number(transaction.credit || 0));
        transaction.debit = debit;
        transaction.credit = credit;

        totalDebit = round2(totalDebit + debit);
        totalCredit = round2(totalCredit + credit);
        runningBalance = round2(runningBalance + debit - credit);
        transaction.balance = runningBalance;

        if (typeof transaction.exchangeRate === 'number') {
            transaction.exchangeRate = round4(transaction.exchangeRate);
        }
        if (typeof transaction.fxDebit === 'number') {
            transaction.fxDebit = round4(transaction.fxDebit);
        }
        if (typeof transaction.fxCredit === 'number') {
            transaction.fxCredit = round4(transaction.fxCredit);
        }

        const currencyKey = normalizeCurrencyCode(transaction.currencyCode);
        const hasExplicitForexContext = (
            (currencyKey && !isTlCurrencyCode(currencyKey)) ||
            (typeof transaction.exchangeRate === 'number' && Math.abs(transaction.exchangeRate - 1) >= 0.0001)
        );
        const fxDebit = typeof transaction.fxDebit === 'number' ? transaction.fxDebit : 0;
        const fxCredit = typeof transaction.fxCredit === 'number' ? transaction.fxCredit : 0;
        const hasMovement = Math.abs(fxDebit) >= 0.0001 || Math.abs(fxCredit) >= 0.0001;
        const hasFxBalance = typeof transaction.fxBalance === 'number' && Number.isFinite(transaction.fxBalance);

        if (hasMovement) {
            const previous = fxRunningByCurrency.get(currencyKey) || 0;
            const next = round4(previous + fxDebit - fxCredit);
            fxRunningByCurrency.set(currencyKey, next);
            transaction.fxBalance = next;
            transaction.fxBalanceManual = false;
            return;
        }

        if (transaction.fxBalanceManual && hasFxBalance) {
            const manualBalance = round4(transaction.fxBalance as number);
            transaction.fxBalance = manualBalance;
            fxRunningByCurrency.set(currencyKey, manualBalance);
            return;
        }

        if (hasFxBalance) {
            const currentBalance = round4(transaction.fxBalance as number);
            const previous = fxRunningByCurrency.get(currencyKey);
            if (typeof previous === 'number') {
                transaction.fxBalance = previous;
                transaction.fxBalanceManual = false;
                return;
            }

            if (hasExplicitForexContext) {
                transaction.fxBalance = currentBalance;
                fxRunningByCurrency.set(currencyKey, currentBalance);
                return;
            }

            // Ambiguous imported balance (no movement/currency context): show it on the row,
            // but do not use it as running-balance seed for following rows.
            transaction.fxBalance = currentBalance;
            transaction.fxBalanceManual = false;
            return;
        }

        const previous = fxRunningByCurrency.get(currencyKey);
        if (typeof previous === 'number') {
            transaction.fxBalance = previous;
            transaction.fxBalanceManual = false;
        } else {
            transaction.fxBalance = undefined;
            transaction.fxBalanceManual = false;
        }
    });

    account.totalDebit = round2(totalDebit);
    account.totalCredit = round2(totalCredit);
    account.transactionCount = account.transactions.length;
    account.balance = round2(account.totalDebit - account.totalCredit);
    return account;
};

const sortAccounts = (accounts: AccountDetail[]): AccountDetail[] => {
    accounts.sort((left, right) => {
        const codeCompare = left.code.localeCompare(right.code, 'tr-TR');
        if (codeCompare !== 0) return codeCompare;
        return left.name.localeCompare(right.name, 'tr-TR');
    });
    return accounts;
};

const buildLogId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const buildLogEntry = (
    field: string,
    fieldLabel: string,
    source: VoucherEditSource,
    voucherNo: string,
    accountBefore: { code: string; name: string },
    accountAfter: { code: string; name: string },
    oldValue: string,
    newValue: string,
    documentNo: string | undefined,
    description: string | undefined,
    transactionId?: string,
    referenceLogId?: string
): VoucherEditLogEntry => ({
    id: buildLogId(),
    createdAt: new Date().toISOString(),
    source,
    transactionId,
    referenceLogId,
    voucherNo,
    accountCodeBefore: accountBefore.code,
    accountNameBefore: accountBefore.name,
    accountCodeAfter: accountAfter.code,
    accountNameAfter: accountAfter.name,
    field,
    fieldLabel,
    oldValue,
    newValue,
    documentNo,
    description,
});

const applySignedFxMovement = (transaction: Transaction, value: number | undefined) => {
    if (typeof value !== 'number' || Math.abs(value) < 0.0001) {
        transaction.fxDebit = undefined;
        transaction.fxCredit = undefined;
        return;
    }

    if (value > 0) {
        transaction.fxDebit = round4(Math.abs(value));
        transaction.fxCredit = undefined;
        return;
    }

    transaction.fxDebit = undefined;
    transaction.fxCredit = round4(Math.abs(value));
};

const accountsHasVoucher = (accounts: AccountDetail[], voucherNo: string): boolean => {
    const target = normalizeVoucherNo(voucherNo);
    if (!target) return false;
    return accounts.some((account) => account.transactions.some((tx) => normalizeVoucherNo(tx.voucherNo) === target));
};

const findTransactionLocation = (
    accounts: AccountDetail[],
    locator: {
        transactionId?: string;
        accountCode?: string;
        transactionIndex?: number;
        voucherNo?: string;
    }
): { accountIndex: number; transactionIndex: number } | null => {
    if (locator.transactionId) {
        for (let accountIndex = 0; accountIndex < accounts.length; accountIndex += 1) {
            const transactionIndex = accounts[accountIndex].transactions.findIndex((tx) => tx.id === locator.transactionId);
            if (transactionIndex >= 0) {
                return { accountIndex, transactionIndex };
            }
        }
    }

    if (locator.accountCode) {
        const accountIndex = accounts.findIndex((account) => account.code === normalizeAccountCode(locator.accountCode));
        if (accountIndex >= 0) {
            const transactionIndex = locator.transactionIndex ?? -1;
            if (transactionIndex >= 0 && transactionIndex < accounts[accountIndex].transactions.length) {
                return { accountIndex, transactionIndex };
            }
        }
    }

    const targetVoucherNo = normalizeVoucherNo(locator.voucherNo);
    if (targetVoucherNo) {
        for (let accountIndex = 0; accountIndex < accounts.length; accountIndex += 1) {
            const transactionIndex = accounts[accountIndex].transactions.findIndex(
                (tx) => normalizeVoucherNo(tx.voucherNo) === targetVoucherNo
            );
            if (transactionIndex >= 0) {
                return { accountIndex, transactionIndex };
            }
        }
    }

    return null;
};

export const filterCurrentAccountScopeData = (accounts: AccountDetail[]): AccountDetail[] => {
    return (accounts || []).reduce<AccountDetail[]>((accumulator, account) => {
        const prefix = account.code.replace(/\D/g, '').slice(0, 3);
        if (!CURRENT_ACCOUNT_SCOPE_PREFIXES.has(prefix)) return accumulator;
        accumulator.push(cloneAccount(account));
        return accumulator;
    }, []);
};

export const applyVoucherEditToAccounts = (
    accounts: AccountDetail[],
    request: VoucherEditRequest
): VoucherMutationResult => {
    const { nextAccounts, ensureMutableAccountAt, markAsMutable } = createMutableAccounts(accounts);
    const location = findTransactionLocation(nextAccounts, request.locator);
    if (!location) {
        return {
            changed: false,
            accounts,
            error: 'Kaynak hesap bulunamadi.',
        };
    }

    const sourceAccount = ensureMutableAccountAt(location.accountIndex);
    if (!sourceAccount) {
        return {
            changed: false,
            accounts,
            error: 'Kaynak hesap bulunamadi.',
        };
    }
    const transaction = sourceAccount.transactions[location.transactionIndex];
    if (!transaction) {
        return {
            changed: false,
            accounts,
            error: 'Duzenlenecek satir bulunamadi.',
        };
    }

    const field = request.field;
    const fieldLabel = getFieldLabel(field);
    const oldValue = getFieldLogValue(field, transaction, sourceAccount);
    const accountBefore = { code: sourceAccount.code, name: sourceAccount.name || '' };
    const beforeDocumentNo = transaction.documentNo;
    const beforeDescription = transaction.description;

    if (field === 'account') {
        const targetCode = normalizeAccountCode(request.targetAccountCode || request.value);
        if (!targetCode) {
            return { changed: false, accounts, error: 'Hesap kodu bos birakilamaz.' };
        }

        const targetNameInput = String(request.targetAccountName || '').trim();
        if (targetCode === sourceAccount.code && (!targetNameInput || targetNameInput === sourceAccount.name)) {
            return { changed: false, accounts };
        }

        sourceAccount.transactions.splice(location.transactionIndex, 1);

        const targetAccountIndex = nextAccounts.findIndex((account) => account.code === targetCode);
        let targetAccount: AccountDetail;
        if (targetAccountIndex < 0) {
            targetAccount = {
                code: targetCode,
                name: targetNameInput || sourceAccount.name || targetCode,
                totalDebit: 0,
                totalCredit: 0,
                balance: 0,
                transactionCount: 0,
                transactions: [],
            };
            nextAccounts.push(targetAccount);
            markAsMutable(targetAccount);
        } else {
            const mutableTarget = ensureMutableAccountAt(targetAccountIndex);
            if (!mutableTarget) {
                return {
                    changed: false,
                    accounts,
                    error: 'Hedef hesap bulunamadi.',
                };
            }
            targetAccount = mutableTarget;
        }

        if (targetNameInput) {
            targetAccount.name = targetNameInput;
        }

        targetAccount.transactions.push(transaction);

        recalcAccount(sourceAccount);
        if (targetAccount !== sourceAccount) {
            recalcAccount(targetAccount);
        }

        if (sourceAccount.transactionCount === 0) {
            const emptyIndex = nextAccounts.indexOf(sourceAccount);
            if (emptyIndex >= 0) {
                nextAccounts.splice(emptyIndex, 1);
            }
        }

        sortAccounts(nextAccounts);

        const accountAfter = { code: targetAccount.code, name: targetAccount.name || '' };
        const logEntry = buildLogEntry(
            field,
            fieldLabel,
            request.locator.source,
            String(transaction.voucherNo || request.locator.voucherNo || '').trim(),
            accountBefore,
            accountAfter,
            oldValue,
            `${accountAfter.code} - ${accountAfter.name}`.trim(),
            transaction.documentNo,
            transaction.description,
            transaction.id
        );

        return {
            changed: true,
            accounts: nextAccounts,
            logEntry,
        };
    }

    if (field === 'date') {
        const parsed = parseDateInput(request.value);
        if (parsed.error) return { changed: false, accounts, error: parsed.error };
        const previous = transaction.date ? transaction.date.getTime() : null;
        const current = parsed.value ? parsed.value.getTime() : null;
        if (previous === current) return { changed: false, accounts };
        transaction.date = parsed.value;
    } else if (field === 'documentNo') {
        const nextValue = String(request.value || '').trim();
        if (String(transaction.documentNo || '') === nextValue) return { changed: false, accounts };
        transaction.documentNo = nextValue || undefined;
    } else if (field === 'description') {
        const nextValue = String(request.value || '');
        if (String(transaction.description || '') === nextValue) return { changed: false, accounts };
        transaction.description = nextValue;
    } else if (field === 'debit') {
        const parsed = parseRequiredNumber(request.value, 'Borc', 2);
        if (parsed.error) return { changed: false, accounts, error: parsed.error };
        if (round2(transaction.debit || 0) === round2(parsed.value || 0)) return { changed: false, accounts };
        transaction.debit = round2(parsed.value || 0);
    } else if (field === 'credit') {
        const parsed = parseRequiredNumber(request.value, 'Alacak', 2);
        if (parsed.error) return { changed: false, accounts, error: parsed.error };
        if (round2(transaction.credit || 0) === round2(parsed.value || 0)) return { changed: false, accounts };
        transaction.credit = round2(parsed.value || 0);
    } else if (field === 'currencyCode') {
        const nextValue = String(request.value || '').trim().toLocaleUpperCase('tr-TR');
        if (String(transaction.currencyCode || '') === nextValue) return { changed: false, accounts };
        transaction.currencyCode = nextValue || undefined;
    } else if (field === 'exchangeRate') {
        const parsed = parseOptionalNumber(request.value, 'Kur', 4);
        if (parsed.error) return { changed: false, accounts, error: parsed.error };
        const previous = typeof transaction.exchangeRate === 'number' ? round4(transaction.exchangeRate) : undefined;
        const nextValue = typeof parsed.value === 'number' ? round4(parsed.value) : undefined;
        if (previous === nextValue) return { changed: false, accounts };
        transaction.exchangeRate = nextValue;
    } else if (field === 'fxMovement') {
        const parsed = parseOptionalNumber(request.value, 'Doviz hareket', 4);
        if (parsed.error) return { changed: false, accounts, error: parsed.error };
        const previousMovement = round4((transaction.fxDebit || 0) - (transaction.fxCredit || 0));
        const nextMovement = round4(parsed.value || 0);
        if (previousMovement === nextMovement) return { changed: false, accounts };
        applySignedFxMovement(transaction, parsed.value);
        // Movement manually changed: clear explicit balance anchor to let running fx balance recalc.
        transaction.fxBalance = undefined;
        transaction.fxBalanceManual = false;
    } else if (field === 'fxBalance') {
        const parsed = parseOptionalNumber(request.value, 'Doviz bakiye', 4);
        if (parsed.error) return { changed: false, accounts, error: parsed.error };
        const previous = typeof transaction.fxBalance === 'number' ? round4(transaction.fxBalance) : undefined;
        const nextValue = typeof parsed.value === 'number' ? round4(parsed.value) : undefined;
        if (previous === nextValue) return { changed: false, accounts };
        transaction.fxBalance = nextValue;
        transaction.fxBalanceManual = typeof nextValue === 'number';
    } else {
        return { changed: false, accounts, error: 'Desteklenmeyen alan.' };
    }

    recalcAccount(sourceAccount);
    sortAccounts(nextAccounts);

    const accountAfter = { code: sourceAccount.code, name: sourceAccount.name || '' };
    const newValue = getFieldLogValue(field, transaction, sourceAccount);
    const logEntry = buildLogEntry(
        field,
        fieldLabel,
        request.locator.source,
        String(transaction.voucherNo || request.locator.voucherNo || '').trim(),
        accountBefore,
        accountAfter,
        oldValue,
        newValue,
        beforeDocumentNo,
        beforeDescription,
        transaction.id
    );

    return {
        changed: true,
        accounts: nextAccounts,
        logEntry,
    };
};

export const applyVoucherEditsToAccounts = (
    accounts: AccountDetail[],
    requests: VoucherEditRequest[]
): VoucherBatchMutationResult => {
    const queue = (requests || []).filter(Boolean);
    if (!queue.length) {
        return {
            changed: false,
            accounts,
            logEntries: [],
        };
    }

    let workingAccounts = accounts;
    const logEntries: VoucherEditLogEntry[] = [];
    let focusVoucherNo: string | undefined;

    for (const request of queue) {
        const result = applyVoucherEditToAccounts(workingAccounts, request);
        if (result.error) {
            return {
                changed: false,
                accounts,
                logEntries: [],
                error: result.error,
            };
        }
        if (!result.changed) continue;

        workingAccounts = result.accounts;
        if (result.logEntry) {
            logEntries.push(result.logEntry);
        }
        if (result.focusVoucherNo) {
            focusVoucherNo = result.focusVoucherNo;
        }
    }

    return {
        changed: logEntries.length > 0,
        accounts: logEntries.length > 0 ? workingAccounts : accounts,
        logEntries,
        focusVoucherNo,
    };
};

export const appendVoucherRowToAccounts = (
    accounts: AccountDetail[],
    request: VoucherAddRowRequest
): VoucherMutationResult => {
    const { nextAccounts, ensureMutableAccountAt, markAsMutable } = createMutableAccounts(accounts);
    const voucherNo = String(request.voucherNo || '').trim();
    if (!voucherNo) {
        return { changed: false, accounts, error: 'Fis no bos birakilamaz.' };
    }

    const accountCode = normalizeAccountCode(request.accountCode);
    if (!accountCode) {
        return { changed: false, accounts, error: 'Hesap kodu bos birakilamaz.' };
    }

    const dateParsed = parseDateInput(request.date);
    if (dateParsed.error) {
        return { changed: false, accounts, error: dateParsed.error };
    }

    const debitParsed = parseRequiredNumber(request.debit, 'Borc', 2);
    if (debitParsed.error) {
        return { changed: false, accounts, error: debitParsed.error };
    }

    const creditParsed = parseRequiredNumber(request.credit, 'Alacak', 2);
    if (creditParsed.error) {
        return { changed: false, accounts, error: creditParsed.error };
    }

    const exchangeRateParsed = parseOptionalNumber(request.exchangeRate, 'Kur', 4);
    if (exchangeRateParsed.error) {
        return { changed: false, accounts, error: exchangeRateParsed.error };
    }
    const fxMovementParsed = parseOptionalNumber(request.fxMovement, 'Doviz hareket', 4);
    if (fxMovementParsed.error) {
        return { changed: false, accounts, error: fxMovementParsed.error };
    }
    const fxBalanceParsed = parseOptionalNumber(request.fxBalance, 'Doviz bakiye', 4);
    if (fxBalanceParsed.error) {
        return { changed: false, accounts, error: fxBalanceParsed.error };
    }

    const existedVoucherBefore = accountsHasVoucher(nextAccounts, voucherNo);

    const targetAccountIndex = nextAccounts.findIndex((account) => account.code === accountCode);
    let targetAccount: AccountDetail;
    if (targetAccountIndex < 0) {
        targetAccount = {
            code: accountCode,
            name: String(request.accountName || '').trim() || accountCode,
            totalDebit: 0,
            totalCredit: 0,
            balance: 0,
            transactionCount: 0,
            transactions: [],
        };
        nextAccounts.push(targetAccount);
        markAsMutable(targetAccount);
    } else {
        const mutableTarget = ensureMutableAccountAt(targetAccountIndex);
        if (!mutableTarget) {
            return { changed: false, accounts, error: 'Hedef hesap bulunamadi.' };
        }
        targetAccount = mutableTarget;
    }

    if (String(request.accountName || '').trim()) {
        targetAccount.name = String(request.accountName || '').trim();
    }

    const documentNo = String(request.documentNo || '').trim() || voucherNo;
    const transaction: Transaction = {
        id: buildTransactionId(),
        date: dateParsed.value,
        description: String(request.description || ''),
        debit: round2(debitParsed.value || 0),
        credit: round2(creditParsed.value || 0),
        voucherNo,
        documentNo,
        currencyCode: String(request.currencyCode || '').trim().toLocaleUpperCase('tr-TR') || undefined,
        exchangeRate: exchangeRateParsed.value,
        fxDebit: undefined,
        fxCredit: undefined,
        fxBalance: fxBalanceParsed.value,
        fxBalanceManual: typeof fxBalanceParsed.value === 'number',
    };
    applySignedFxMovement(transaction, fxMovementParsed.value);
    targetAccount.transactions.push(transaction);

    recalcAccount(targetAccount);
    sortAccounts(nextAccounts);

    const field = existedVoucherBefore ? 'add-row' : 'add-new-voucher';
    const fieldLabel = existedVoucherBefore ? 'Fis Satiri Ekleme' : 'Yeni Fis Satiri Ekleme';
    const rowSummary = [
        `Tarih: ${formatDateForLog(transaction.date) || '-'}`,
        `Borc: ${formatNumberForLog(transaction.debit) || '0'}`,
        `Alacak: ${formatNumberForLog(transaction.credit) || '0'}`,
    ].join(' | ');

    const logEntry = buildLogEntry(
        field,
        fieldLabel,
        request.source,
        voucherNo,
        { code: targetAccount.code, name: targetAccount.name || '' },
        { code: targetAccount.code, name: targetAccount.name || '' },
        '-',
        rowSummary,
        transaction.documentNo,
        transaction.description,
        transaction.id
    );

    return {
        changed: true,
        accounts: nextAccounts,
        logEntry,
        focusVoucherNo: voucherNo,
    };
};

const applyFieldValueFromLog = (
    transaction: Transaction,
    field: string,
    rawValue: string
): { ok: boolean; error?: string } => {
    const value = String(rawValue || '').trim();
    if (field === 'date') {
        const parsed = parseDateInput(value);
        if (parsed.error) return { ok: false, error: parsed.error };
        transaction.date = parsed.value;
        return { ok: true };
    }
    if (field === 'documentNo') {
        transaction.documentNo = value || undefined;
        return { ok: true };
    }
    if (field === 'description') {
        transaction.description = rawValue || '';
        return { ok: true };
    }
    if (field === 'debit') {
        const parsed = parseRequiredNumber(value, 'Borc', 2);
        if (parsed.error) return { ok: false, error: parsed.error };
        transaction.debit = round2(parsed.value || 0);
        return { ok: true };
    }
    if (field === 'credit') {
        const parsed = parseRequiredNumber(value, 'Alacak', 2);
        if (parsed.error) return { ok: false, error: parsed.error };
        transaction.credit = round2(parsed.value || 0);
        return { ok: true };
    }
    if (field === 'currencyCode') {
        transaction.currencyCode = value ? value.toLocaleUpperCase('tr-TR') : undefined;
        return { ok: true };
    }
    if (field === 'exchangeRate') {
        const parsed = parseOptionalNumber(value, 'Kur', 4);
        if (parsed.error) return { ok: false, error: parsed.error };
        transaction.exchangeRate = parsed.value;
        return { ok: true };
    }
    if (field === 'fxMovement') {
        const parsed = parseOptionalNumber(value, 'Doviz hareket', 4);
        if (parsed.error) return { ok: false, error: parsed.error };
        applySignedFxMovement(transaction, parsed.value);
        transaction.fxBalance = undefined;
        transaction.fxBalanceManual = false;
        return { ok: true };
    }
    if (field === 'fxBalance') {
        const parsed = parseOptionalNumber(value, 'Doviz bakiye', 4);
        if (parsed.error) return { ok: false, error: parsed.error };
        transaction.fxBalance = parsed.value;
        transaction.fxBalanceManual = typeof parsed.value === 'number';
        return { ok: true };
    }
    return { ok: false, error: 'Bu alan geri alinamiyor.' };
};

export const undoVoucherEditOnAccounts = (
    accounts: AccountDetail[],
    logEntry: VoucherEditLogEntry
): VoucherMutationResult => {
    const { nextAccounts, ensureMutableAccountAt, markAsMutable } = createMutableAccounts(accounts);
    const location = findTransactionLocation(nextAccounts, {
        transactionId: logEntry.transactionId,
        accountCode: logEntry.accountCodeAfter || logEntry.accountCodeBefore,
        voucherNo: logEntry.voucherNo,
    });

    if (!location) {
        return {
            changed: false,
            accounts,
            error: 'Geri alinacak satir bulunamadi.',
        };
    }

    const sourceAccount = ensureMutableAccountAt(location.accountIndex);
    if (!sourceAccount) {
        return {
            changed: false,
            accounts,
            error: 'Geri alinacak satir bulunamadi.',
        };
    }
    const transaction = sourceAccount.transactions[location.transactionIndex];
    if (!transaction) {
        return {
            changed: false,
            accounts,
            error: 'Geri alinacak satir bulunamadi.',
        };
    }

    const field = String(logEntry.field || '').trim();

    if (field === 'add-row' || field === 'add-new-voucher') {
        sourceAccount.transactions.splice(location.transactionIndex, 1);
        recalcAccount(sourceAccount);
        if (sourceAccount.transactionCount === 0) {
            const emptyIndex = nextAccounts.indexOf(sourceAccount);
            if (emptyIndex >= 0) {
                nextAccounts.splice(emptyIndex, 1);
            }
        }
        sortAccounts(nextAccounts);

        const undoLog = buildLogEntry(
            `undo-${field}`,
            `Geri Al - ${logEntry.fieldLabel}`,
            logEntry.source,
            logEntry.voucherNo,
            { code: logEntry.accountCodeAfter, name: logEntry.accountNameAfter },
            { code: logEntry.accountCodeAfter, name: logEntry.accountNameAfter },
            logEntry.newValue,
            logEntry.oldValue,
            logEntry.documentNo,
            logEntry.description,
            logEntry.transactionId,
            logEntry.id
        );

        return {
            changed: true,
            accounts: nextAccounts,
            logEntry: undoLog,
        };
    }

    if (field === 'account') {
        const targetCode = normalizeAccountCode(logEntry.accountCodeBefore);
        if (!targetCode) {
            return {
                changed: false,
                accounts,
                error: 'Geri al icin hedef hesap bulunamadi.',
            };
        }

        sourceAccount.transactions.splice(location.transactionIndex, 1);
        const targetAccountIndex = nextAccounts.findIndex((account) => account.code === targetCode);
        let targetAccount: AccountDetail;
        if (targetAccountIndex < 0) {
            targetAccount = {
                code: targetCode,
                name: logEntry.accountNameBefore || targetCode,
                totalDebit: 0,
                totalCredit: 0,
                balance: 0,
                transactionCount: 0,
                transactions: [],
            };
            nextAccounts.push(targetAccount);
            markAsMutable(targetAccount);
        } else {
            const mutableTarget = ensureMutableAccountAt(targetAccountIndex);
            if (!mutableTarget) {
                return {
                    changed: false,
                    accounts,
                    error: 'Geri al icin hedef hesap bulunamadi.',
                };
            }
            targetAccount = mutableTarget;
        }

        if (logEntry.accountNameBefore) {
            targetAccount.name = logEntry.accountNameBefore;
        }
        targetAccount.transactions.push(transaction);

        recalcAccount(sourceAccount);
        if (targetAccount !== sourceAccount) {
            recalcAccount(targetAccount);
        }
        if (sourceAccount.transactionCount === 0) {
            const emptyIndex = nextAccounts.indexOf(sourceAccount);
            if (emptyIndex >= 0) {
                nextAccounts.splice(emptyIndex, 1);
            }
        }
        sortAccounts(nextAccounts);

        const undoLog = buildLogEntry(
            `undo-${field}`,
            `Geri Al - ${logEntry.fieldLabel}`,
            logEntry.source,
            logEntry.voucherNo,
            { code: logEntry.accountCodeAfter, name: logEntry.accountNameAfter },
            { code: logEntry.accountCodeBefore, name: logEntry.accountNameBefore },
            logEntry.newValue,
            logEntry.oldValue,
            logEntry.documentNo,
            logEntry.description,
            logEntry.transactionId,
            logEntry.id
        );

        return {
            changed: true,
            accounts: nextAccounts,
            logEntry: undoLog,
        };
    }

    const applyResult = applyFieldValueFromLog(transaction, field, logEntry.oldValue);
    if (!applyResult.ok) {
        return {
            changed: false,
            accounts,
            error: applyResult.error || 'Geri al islemi basarisiz.',
        };
    }

    recalcAccount(sourceAccount);
    sortAccounts(nextAccounts);

    const undoLog = buildLogEntry(
        `undo-${field}`,
        `Geri Al - ${logEntry.fieldLabel}`,
        logEntry.source,
        logEntry.voucherNo,
        { code: logEntry.accountCodeAfter, name: logEntry.accountNameAfter },
        { code: sourceAccount.code, name: sourceAccount.name || '' },
        logEntry.newValue,
        logEntry.oldValue,
        logEntry.documentNo,
        logEntry.description,
        transaction.id,
        logEntry.id
    );

    return {
        changed: true,
        accounts: nextAccounts,
        logEntry: undoLog,
    };
};
