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
    ];
};
