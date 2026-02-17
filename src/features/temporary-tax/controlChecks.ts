import type { AccountDetail } from '../common/types';
import { getMainAccountCode, resolveAccountBalanceRule, type ExpectedBalanceSide } from '../mizan/accountingRules';
import type { ForexOverrideMap } from '../mizan/forexAccountRules';
import { resolveForexAccountType } from '../mizan/forexAccountRules';

type ActualBalanceSide = 'BORC' | 'ALACAK' | 'KAPALI';

export interface TemporaryTaxRowIssue {
    rowIndex: number;
    code: string;
    message: string;
}

export interface TemporaryTaxControlItem {
    account: AccountDetail;
    reason: string;
    detail?: string;
    issueCount?: number;
    firstIssueDate?: string;
    minBalance?: number;
    rowIssues?: TemporaryTaxRowIssue[];
}

export interface TemporaryTaxControlResult {
    id: string;
    title: string;
    description: string;
    accounts: TemporaryTaxControlItem[];
}

const BALANCE_TOLERANCE = 0.01;
const FX_EQUAL_TOLERANCE = 0.01;
const CODE_REVERSE_BALANCE = 'TB-001';
const CODE_KASA_DAY_END_CREDIT = 'KS-001';
const CODE_FOREX_EQUAL_AMOUNTS = 'DV-001';
const CODE_TAX_ACCRUAL_PAYMENT_MATCH = 'TV-360-361-001';
const OPENING_VOUCHER_SEQUENCE_LIMIT = 50;

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const getActualBalanceSide = (balance: number): ActualBalanceSide => {
    if (Math.abs(balance) <= BALANCE_TOLERANCE) return 'KAPALI';
    return balance > 0 ? 'BORC' : 'ALACAK';
};

const parseDateKey = (value: string): Date | null => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
};

const formatDateKey = (value: string): string => {
    const parsed = parseDateKey(value);
    if (!parsed) return value;
    return parsed.toLocaleDateString('tr-TR');
};

const toDateKey = (value: Date | null | undefined): string => {
    if (!value) return 'TARIHSIZ';
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'TARIHSIZ';
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
};

const toMonthKey = (value: Date | null | undefined): string => {
    if (!value) return 'TARIHSIZ';
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'TARIHSIZ';
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
};

const addOneMonth = (monthKey: string): string | null => {
    const match = monthKey.match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;

    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
};

const subtractOneMonth = (monthKey: string): string | null => {
    const match = monthKey.match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;

    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
};

const formatMonthKey = (monthKey: string): string => {
    const match = monthKey.match(/^(\d{4})-(\d{2})$/);
    if (!match) return monthKey;
    const month = Number(match[2]);
    const year = Number(match[1]);
    if (!Number.isInteger(month) || !Number.isInteger(year)) return monthKey;
    return `${String(month).padStart(2, '0')}.${year}`;
};

const normalizeAscii = (value: string | undefined): string => {
    return String(value || '')
        .toLocaleUpperCase('tr-TR')
        .replace(/Ç/g, 'C')
        .replace(/Ğ/g, 'G')
        .replace(/İ/g, 'I')
        .replace(/I/g, 'I')
        .replace(/Ö/g, 'O')
        .replace(/Ş/g, 'S')
        .replace(/Ü/g, 'U')
        .trim();
};

const isJanuaryFirst = (value: Date | null | undefined): boolean => {
    if (!value) return false;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed.getMonth() === 0 && parsed.getDate() === 1;
};

const parseVoucherSequence = (voucherNo: string | undefined): number | null => {
    const digits = String(voucherNo || '').replace(/\D/g, '');
    if (!digits) return null;
    const parsed = Number(digits);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
};

const hasOpeningVoucherHint = (
    voucherNo: string | undefined,
    documentNo: string | undefined,
    description: string | undefined,
    transactionDate: Date | null | undefined
): boolean => {
    const voucherText = normalizeAscii(voucherNo);
    const documentText = normalizeAscii(documentNo);
    const descriptionText = normalizeAscii(description);
    const descriptionRaw = String(description || '').toLocaleLowerCase('tr-TR');
    const combinedVoucherText = `${voucherText} ${documentText}`.trim();

    // Kullanici beklentisi: 01.01 tarihli satirda aciklamada "Acilis" (Açılış) geciyorsa acilis fisidir.
    if (isJanuaryFirst(transactionDate) && (descriptionRaw.includes('açılış') || descriptionText.includes('ACILIS'))) {
        return true;
    }

    if (
        combinedVoucherText.includes('ACILIS') ||
        combinedVoucherText.includes('DEVIR') ||
        combinedVoucherText.includes('OPEN')
    ) {
        return true;
    }

    const voucherSequence = parseVoucherSequence(voucherNo) ?? parseVoucherSequence(documentNo);
    if (voucherSequence !== null && voucherSequence >= 0 && voucherSequence <= OPENING_VOUCHER_SEQUENCE_LIMIT) {
        return true;
    }

    // Fis numarasinda acik sinyal yoksa son fallback: aciklama metni
    return descriptionText.includes('ACILIS') || descriptionText.includes('DEVIR');
};

const getExpectedBalanceLabel = (side: ExpectedBalanceSide): string => {
    if (side === 'BORC') return 'Borc';
    if (side === 'ALACAK') return 'Alacak';
    return 'Fark etmez';
};

const getActualBalanceLabel = (side: ActualBalanceSide): string => {
    if (side === 'BORC') return 'Borc';
    if (side === 'ALACAK') return 'Alacak';
    return 'Kapali';
};

const formatIssueDate = (value: Date | null | undefined): string => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return 'Tarihsiz';
    return value.toLocaleDateString('tr-TR');
};

const isNearlyEqual = (left: number, right: number, tolerance = FX_EQUAL_TOLERANCE): boolean => {
    return Math.abs(left - right) <= tolerance;
};

const evaluateReverseBalanceAccounts = (accounts: AccountDetail[]): TemporaryTaxControlItem[] => {
    return accounts.flatMap((account) => {
        const rule = resolveAccountBalanceRule(account.code);
        const actualSide = getActualBalanceSide(account.balance);
        const expectedSide = rule?.expectedBalance || 'FARK_ETMEZ';
        const isMismatch = (
            expectedSide !== 'FARK_ETMEZ' &&
            actualSide !== 'KAPALI' &&
            actualSide !== expectedSide
        );

        if (!isMismatch) return [];

        const rowIssues: TemporaryTaxRowIssue[] = [];
        account.transactions.forEach((transaction, index) => {
            const rowSide = getActualBalanceSide(typeof transaction.balance === 'number' ? transaction.balance : 0);
            const rowMismatch = (
                rowSide !== 'KAPALI' &&
                rowSide !== expectedSide
            );
            if (!rowMismatch) return;

            rowIssues.push({
                rowIndex: index,
                code: CODE_REVERSE_BALANCE,
                message: `${getExpectedBalanceLabel(expectedSide)} beklenirken ${getActualBalanceLabel(rowSide)} bakiye.`,
            });
        });

        const firstRowIssue = rowIssues[0];
        const firstIssueDate = firstRowIssue ? formatIssueDate(account.transactions[firstRowIssue.rowIndex]?.date) : 'Tarihsiz';

        return [{
            account,
            reason: `[${CODE_REVERSE_BALANCE}] ${getExpectedBalanceLabel(expectedSide)} beklenirken ${getActualBalanceLabel(actualSide)} bakiye verdi.`,
            detail: `Ilk ters bakiye satiri: ${firstIssueDate}`,
            issueCount: rowIssues.length || undefined,
            rowIssues,
        }];
    });
};

const evaluateCashAccountCreditDayEnd = (accounts: AccountDetail[]): TemporaryTaxControlItem[] => {
    const cashAccounts = accounts.filter((account) => getMainAccountCode(account.code) === '100');

    return cashAccounts.flatMap((account) => {
        const dayEndBalance = new Map<string, { balance: number; rowIndex: number }>();
        let runningBalance = 0;

        account.transactions.forEach((transaction, index) => {
            runningBalance = typeof transaction.balance === 'number'
                ? transaction.balance
                : (runningBalance + transaction.debit - transaction.credit);

            const dateKey = toDateKey(transaction.date);
            dayEndBalance.set(dateKey, { balance: runningBalance, rowIndex: index });
        });

        const violations = Array.from(dayEndBalance.entries())
            .filter(([dateKey, info]) => dateKey !== 'TARIHSIZ' && info.balance < -BALANCE_TOLERANCE)
            .sort((left, right) => left[0].localeCompare(right[0], 'tr-TR'));

        if (!violations.length) return [];

        const firstIssueDate = violations[0][0];
        const minBalance = violations.reduce((min, [, info]) => (info.balance < min ? info.balance : min), 0);
        const rowIssues: TemporaryTaxRowIssue[] = violations.map(([dateKey, info]) => ({
            rowIndex: info.rowIndex,
            code: CODE_KASA_DAY_END_CREDIT,
            message: `${formatDateKey(dateKey)} gun sonu alacak bakiye: ${Math.abs(info.balance).toFixed(2)}`,
        }));

        return [{
            account,
            reason: `[${CODE_KASA_DAY_END_CREDIT}] ${violations.length} gun sonu alacak bakiyesi olustu.`,
            detail: `Ilk ihlal tarihi: ${formatDateKey(firstIssueDate)}`,
            issueCount: violations.length,
            firstIssueDate,
            minBalance,
            rowIssues,
        }];
    });
};

const evaluateForexTlFxEqualAmounts = (
    accounts: AccountDetail[],
    overrides?: ForexOverrideMap
): TemporaryTaxControlItem[] => {
    return accounts.flatMap((account) => {
        const forexType = resolveForexAccountType(account.code, account.name || '', overrides);
        if (!forexType.isForex) return [];

        const rowIssues: TemporaryTaxRowIssue[] = [];

        account.transactions.forEach((transaction, index) => {
            const issueParts: string[] = [];
            const hasDebitMatch = (
                transaction.debit > 0 &&
                typeof transaction.fxDebit === 'number' &&
                isNearlyEqual(Math.abs(transaction.debit), Math.abs(transaction.fxDebit))
            );
            if (hasDebitMatch) issueParts.push('Borc TL = Doviz Borc');

            const hasCreditMatch = (
                transaction.credit > 0 &&
                typeof transaction.fxCredit === 'number' &&
                isNearlyEqual(Math.abs(transaction.credit), Math.abs(transaction.fxCredit))
            );
            if (hasCreditMatch) issueParts.push('Alacak TL = Doviz Alacak');

            const hasBalanceMatch = (
                typeof transaction.balance === 'number' &&
                typeof transaction.fxBalance === 'number' &&
                Math.abs(transaction.fxBalance) > 0 &&
                isNearlyEqual(Math.abs(transaction.balance), Math.abs(transaction.fxBalance))
            );
            if (hasBalanceMatch) issueParts.push('Bakiye TL = Doviz Bakiye');

            if (!issueParts.length) return;

            rowIssues.push({
                rowIndex: index,
                code: CODE_FOREX_EQUAL_AMOUNTS,
                message: issueParts.join(' | '),
            });
        });

        if (!rowIssues.length) return [];

        const datedRows = rowIssues
            .map((issue) => account.transactions[issue.rowIndex]?.date)
            .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()))
            .sort((left, right) => left.getTime() - right.getTime());
        const firstIssueDateLabel = datedRows.length > 0 ? datedRows[0].toLocaleDateString('tr-TR') : 'Tarihsiz';

        return [{
            account,
            reason: `[${CODE_FOREX_EQUAL_AMOUNTS}] ${rowIssues.length} satirda TL ve doviz tutari esit gorunuyor.`,
            detail: `Ilk satir tarihi: ${firstIssueDateLabel}`,
            issueCount: rowIssues.length,
            rowIssues,
        }];
    });
};

const evaluateTaxAccrualPaymentMatch = (accounts: AccountDetail[]): TemporaryTaxControlItem[] => {
    const targets = accounts.filter((account) => {
        const mainCode = getMainAccountCode(account.code);
        return mainCode === '360' || mainCode === '361';
    });

    return targets.flatMap((account) => {
        type MonthAggregate = { debit: number; credit: number; firstRowIndex: number };
        type OpeningVoucherAggregate = {
            monthKey: string;
            debit: number;
            credit: number;
            firstRowIndex: number;
            hasHint: boolean;
        };

        const monthMap = new Map<string, MonthAggregate>();
        const openingVoucherMap = new Map<string, OpeningVoucherAggregate>();

        const ensureMonthAggregate = (monthKey: string, rowIndex: number): MonthAggregate => {
            const existing = monthMap.get(monthKey);
            if (existing) {
                if (rowIndex < existing.firstRowIndex) {
                    existing.firstRowIndex = rowIndex;
                }
                return existing;
            }

            const created: MonthAggregate = { debit: 0, credit: 0, firstRowIndex: rowIndex };
            monthMap.set(monthKey, created);
            return created;
        };

        const normalizeAmount = (value: number): number => {
            const rounded = round2(value);
            return Math.abs(rounded) <= BALANCE_TOLERANCE ? 0 : rounded;
        };

        const getVoucherGroupKey = (voucherNo: string | undefined, documentNo: string | undefined, rowIndex: number): string => {
            const normalizedVoucher = String(voucherNo || '').trim().toLocaleUpperCase('tr-TR');
            const normalizedDocument = String(documentNo || '').trim().toLocaleUpperCase('tr-TR');
            const key = normalizedVoucher || normalizedDocument;
            return key || `ROW-${rowIndex}`;
        };

        account.transactions.forEach((transaction, rowIndex) => {
            const monthKey = toMonthKey(transaction.date);
            if (monthKey === 'TARIHSIZ') return;

            const monthAggregate = ensureMonthAggregate(monthKey, rowIndex);
            monthAggregate.debit = round2(monthAggregate.debit + (transaction.debit || 0));
            monthAggregate.credit = round2(monthAggregate.credit + (transaction.credit || 0));

            if (!isJanuaryFirst(transaction.date)) return;

            const voucherKey = getVoucherGroupKey(transaction.voucherNo, transaction.documentNo, rowIndex);
            const hint = hasOpeningVoucherHint(
                transaction.voucherNo,
                transaction.documentNo,
                transaction.description,
                transaction.date
            );
            const currentOpening = openingVoucherMap.get(voucherKey);

            if (!currentOpening) {
                openingVoucherMap.set(voucherKey, {
                    monthKey,
                    debit: transaction.debit || 0,
                    credit: transaction.credit || 0,
                    firstRowIndex: rowIndex,
                    hasHint: hint,
                });
                return;
            }

            currentOpening.debit = round2(currentOpening.debit + (transaction.debit || 0));
            currentOpening.credit = round2(currentOpening.credit + (transaction.credit || 0));
            currentOpening.hasHint = currentOpening.hasHint || hint;
            if (rowIndex < currentOpening.firstRowIndex) {
                currentOpening.firstRowIndex = rowIndex;
            }
        });

        // 01.01 acilis fislerini Ocak'tan cikartip Onceki Aralik tahakkuku olarak yorumlariz.
        // Boylece acilis fisindeki borc/alacak mahsubu net tahakkuku verir.
        openingVoucherMap.forEach((openingVoucher) => {
            const hasMahsup = (
                openingVoucher.debit > BALANCE_TOLERANCE &&
                openingVoucher.credit > BALANCE_TOLERANCE
            );
            if (!openingVoucher.hasHint && !hasMahsup) return;

            const januaryAggregate = monthMap.get(openingVoucher.monthKey);
            if (januaryAggregate) {
                januaryAggregate.debit = normalizeAmount(januaryAggregate.debit - openingVoucher.debit);
                januaryAggregate.credit = normalizeAmount(januaryAggregate.credit - openingVoucher.credit);
            }

            const previousMonthKey = subtractOneMonth(openingVoucher.monthKey);
            if (!previousMonthKey) return;

            const netAccrual = normalizeAmount(openingVoucher.credit - openingVoucher.debit);
            if (Math.abs(netAccrual) <= BALANCE_TOLERANCE) return;

            const previousMonthAggregate = ensureMonthAggregate(previousMonthKey, openingVoucher.firstRowIndex);
            if (netAccrual > 0) {
                previousMonthAggregate.credit = round2(previousMonthAggregate.credit + netAccrual);
                return;
            }

            previousMonthAggregate.debit = round2(previousMonthAggregate.debit + Math.abs(netAccrual));
        });

        const monthKeys = Array.from(monthMap.keys())
            .filter((monthKey) => {
                const month = monthMap.get(monthKey);
                if (!month) return false;
                return Math.abs(month.debit) > BALANCE_TOLERANCE || Math.abs(month.credit) > BALANCE_TOLERANCE;
            })
            .sort((a, b) => a.localeCompare(b, 'tr-TR'));
        const rowIssues: TemporaryTaxRowIssue[] = [];

        monthKeys.forEach((monthKey) => {
            const currentMonth = monthMap.get(monthKey);
            if (!currentMonth) return;

            const nextMonthKey = addOneMonth(monthKey);
            if (!nextMonthKey) return;

            // Sonraki ay veri setinde yoksa, bu ayi kontrol etmeyiz (acik tahakkuk olabilir).
            if (!monthMap.has(nextMonthKey)) return;

            const nextMonth = monthMap.get(nextMonthKey);
            if (!nextMonth) return;

            const accrual = currentMonth.credit;
            // Tahakkuk olmayan aylar bir sonraki aya referans kontrolu uretemez.
            // Aksi halde "odeme ayi" gereksiz yere hata verir (false positive).
            if (Math.abs(accrual) <= BALANCE_TOLERANCE) return;
            const payment = nextMonth.debit;
            const diff = payment - accrual;

            if (Math.abs(diff) <= BALANCE_TOLERANCE) return;

            rowIssues.push({
                rowIndex: currentMonth.firstRowIndex,
                code: CODE_TAX_ACCRUAL_PAYMENT_MATCH,
                message: `${formatMonthKey(monthKey)} tahakkuk: ${accrual.toFixed(2)} | ${formatMonthKey(nextMonthKey)} odeme: ${payment.toFixed(2)} | fark: ${diff.toFixed(2)}`,
            });
        });

        if (!rowIssues.length) return [];

        const firstIssue = rowIssues[0];
        const firstIssueDate = formatIssueDate(account.transactions[firstIssue.rowIndex]?.date);

        return [{
            account,
            reason: `[${CODE_TAX_ACCRUAL_PAYMENT_MATCH}] Aylik tahakkuk (alacak) ve sonraki ay odeme (borc) tutarlari eslesmiyor.`,
            detail: `Ilk uyumsuz satir tarihi: ${firstIssueDate}`,
            issueCount: rowIssues.length,
            rowIssues,
        }];
    });
};

export const buildTemporaryTaxControls = (
    accounts: AccountDetail[],
    forexOverrides?: ForexOverrideMap
): TemporaryTaxControlResult[] => {
    return [
        {
            id: 'reverse-balance',
            title: 'Ters Bakiye Veren Hesaplar',
            description: 'Hesabin dogal bakiye yonune aykiri kapanan hesaplar.',
            accounts: evaluateReverseBalanceAccounts(accounts),
        },
        {
            id: 'kasa-day-end-credit',
            title: '100 Kasa Gun Sonu Kontrolu',
            description: '100 kasa hesaplarinda gun sonu alacak bakiyesi olusmamali.',
            accounts: evaluateCashAccountCreditDayEnd(accounts),
        },
        {
            id: 'forex-tl-fx-equal',
            title: 'Doviz Hesapta TL-Doviz Esit Tutar',
            description: 'Dovizli hesapta TL ve doviz tarafi esit satirlar yuksek olasilikla hatalidir.',
            accounts: evaluateForexTlFxEqualAmounts(accounts, forexOverrides),
        },
        {
            id: 'tax-360-361-accrual-payment',
            title: '360-361 Tahakkuk/Odeme Eslesme',
            description: 'Ayin alacak tahakkuku, bir sonraki ay borc odemesiyle eslesmeli. Son ay otomatik dislanir.',
            accounts: evaluateTaxAccrualPaymentMatch(accounts),
        },
    ];
};
