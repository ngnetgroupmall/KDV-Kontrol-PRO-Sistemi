import { v4 as uuidv4 } from 'uuid';
import type { AccountDetail, Transaction } from '../../common/types';
import type {
    ComparableTransaction,
    ComparisonResult,
    MatchStatus,
    TransactionComparisonSummary,
    TransactionDiffRow,
} from './types';

const TARGET_PREFIXES = new Set(['120', '320', '159', '340', '336']);
const NAME_MATCH_THRESHOLD = 0.62;
const TOLERANCE = 0.01;

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const toCents = (value: number): number => Math.round(round2(value) * 100);

const getAccountPrefix = (accountCode: string): string => String(accountCode ?? '').replace(/\D/g, '').slice(0, 3);

const isTargetAccount = (account: AccountDetail): boolean => TARGET_PREFIXES.has(getAccountPrefix(account.code));

const normalizeName = (name: string): string => {
    return name
        .toLocaleLowerCase('tr-TR')
        .replace(/ı/g, 'i')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/['".,;:_\-()/\\]/g, ' ')
        .replace(/\b(LTD|LIMITED|AS|A S|ANONIM|SIRKETI|SANAYI|TICARET|VE)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const tokenize = (normalizedName: string): string[] => {
    return normalizedName
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length > 1);
};

const levenshteinDistance = (a: string, b: string): number => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const matrix: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

    for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    return matrix[a.length][b.length];
};

const jaccardSimilarity = (aTokens: string[], bTokens: string[]): number => {
    if (!aTokens.length && !bTokens.length) return 1;

    const aSet = new Set(aTokens);
    const bSet = new Set(bTokens);
    let intersection = 0;

    aSet.forEach((token) => {
        if (bSet.has(token)) intersection += 1;
    });

    const union = new Set([...aSet, ...bSet]).size;
    return union === 0 ? 0 : intersection / union;
};

const calculateNameSimilarity = (leftName: string, rightName: string): number => {
    const leftNormalized = normalizeName(leftName);
    const rightNormalized = normalizeName(rightName);

    if (!leftNormalized || !rightNormalized) return 0;
    if (leftNormalized === rightNormalized) return 1;

    const leftTokens = tokenize(leftNormalized);
    const rightTokens = tokenize(rightNormalized);

    const jaccard = jaccardSimilarity(leftTokens, rightTokens);
    const levDistance = levenshteinDistance(leftNormalized, rightNormalized);
    const maxLen = Math.max(leftNormalized.length, rightNormalized.length);
    const levenshteinScore = maxLen === 0 ? 0 : 1 - levDistance / maxLen;

    return round2(jaccard * 0.65 + levenshteinScore * 0.35);
};

const formatDateKey = (date: unknown): string => {
    if (!date) return 'TARIHSIZ';

    const parsedDate = date instanceof Date ? date : new Date(String(date));
    if (Number.isNaN(parsedDate.getTime())) return 'TARIHSIZ';

    return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
};

const toComparableTransaction = (transaction: Transaction): ComparableTransaction => ({
    date: formatDateKey(transaction.date),
    debit: round2(transaction.debit || 0),
    credit: round2(transaction.credit || 0),
    balance: typeof transaction.balance === 'number' ? round2(transaction.balance) : undefined,
    description: String(transaction.description || '').trim(),
    voucherNo: String(transaction.voucherNo || '').trim() || undefined,
});

const getTransactionKey = (transaction: ComparableTransaction): string => {
    return `${transaction.date}|${toCents(transaction.debit)}|${toCents(transaction.credit)}`;
};

const parseTransactionKey = (key: string): ComparableTransaction => {
    const [date, debitCents, creditCents] = key.split('|');
    return {
        date,
        debit: Number(debitCents) / 100,
        credit: Number(creditCents) / 100,
        balance: undefined,
        description: '',
        voucherNo: undefined,
    };
};

interface TransactionComparisonDetail {
    summary: TransactionComparisonSummary;
    diffRows: TransactionDiffRow[];
    unmatchedSmmmTransactions: ComparableTransaction[];
    unmatchedFirmaTransactions: ComparableTransaction[];
}

const compareTransactions = (
    smmmTransactions: Transaction[],
    firmaTransactions: Transaction[]
): TransactionComparisonDetail => {
    const smmmComparable = smmmTransactions.map(toComparableTransaction);
    const firmaComparable = firmaTransactions.map(toComparableTransaction);

    const smmmBuckets = new Map<string, ComparableTransaction[]>();
    const firmaBuckets = new Map<string, ComparableTransaction[]>();

    smmmComparable.forEach((tx) => {
        const key = getTransactionKey(tx);
        const bucket = smmmBuckets.get(key) || [];
        bucket.push(tx);
        smmmBuckets.set(key, bucket);
    });

    firmaComparable.forEach((tx) => {
        const key = getTransactionKey(tx);
        const bucket = firmaBuckets.get(key) || [];
        bucket.push(tx);
        firmaBuckets.set(key, bucket);
    });

    const allKeys = Array.from(new Set([...smmmBuckets.keys(), ...firmaBuckets.keys()]));
    const diffRows: TransactionDiffRow[] = [];
    const unmatchedSmmmTransactions: ComparableTransaction[] = [];
    const unmatchedFirmaTransactions: ComparableTransaction[] = [];

    let matched = 0;
    let onlyInSmmm = 0;
    let onlyInFirma = 0;

    allKeys.forEach((key) => {
        const smmmItems = smmmBuckets.get(key) || [];
        const firmaItems = firmaBuckets.get(key) || [];
        const smmmCount = smmmItems.length;
        const firmaCount = firmaItems.length;
        const matchedCount = Math.min(smmmCount, firmaCount);
        const smmmOnlyCount = smmmCount - matchedCount;
        const firmaOnlyCount = firmaCount - matchedCount;

        matched += matchedCount;
        onlyInSmmm += smmmOnlyCount;
        onlyInFirma += firmaOnlyCount;

        if (smmmOnlyCount > 0) {
            unmatchedSmmmTransactions.push(...smmmItems.slice(0, smmmOnlyCount));
        }
        if (firmaOnlyCount > 0) {
            unmatchedFirmaTransactions.push(...firmaItems.slice(0, firmaOnlyCount));
        }

        if (smmmOnlyCount > 0 || firmaOnlyCount > 0) {
            const parsed = parseTransactionKey(key);
            diffRows.push({
                key,
                date: parsed.date,
                debit: parsed.debit,
                credit: parsed.credit,
                smmmCount,
                firmaCount,
                matchedCount,
                onlyInSmmm: smmmOnlyCount,
                onlyInFirma: firmaOnlyCount,
            });
        }
    });

    diffRows.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        if (a.debit !== b.debit) return a.debit - b.debit;
        return a.credit - b.credit;
    });

    unmatchedSmmmTransactions.sort((a, b) => a.date.localeCompare(b.date));
    unmatchedFirmaTransactions.sort((a, b) => a.date.localeCompare(b.date));

    return {
        summary: {
            smmmTotal: smmmComparable.length,
            firmaTotal: firmaComparable.length,
            matched,
            onlyInSmmm,
            onlyInFirma,
        },
        diffRows,
        unmatchedSmmmTransactions,
        unmatchedFirmaTransactions,
    };
};

const buildUnmatchedSmmmResult = (account: AccountDetail, notes?: string): ComparisonResult => {
    const comparable = account.transactions.map(toComparableTransaction);
    return {
        id: uuidv4(),
        smmmAccount: account,
        firmaAccount: undefined,
        status: 'UNMATCHED_SMMM',
        matchScore: 0,
        difference: round2(account.balance),
        debitDifference: round2(account.totalDebit),
        creditDifference: round2(account.totalCredit),
        transactionSummary: {
            smmmTotal: comparable.length,
            firmaTotal: 0,
            matched: 0,
            onlyInSmmm: comparable.length,
            onlyInFirma: 0,
        },
        transactionDiffRows: [],
        unmatchedSmmmTransactions: comparable,
        unmatchedFirmaTransactions: [],
        notes,
    };
};

const buildUnmatchedFirmaResult = (account: AccountDetail): ComparisonResult => {
    const comparable = account.transactions.map(toComparableTransaction);
    return {
        id: uuidv4(),
        smmmAccount: undefined,
        firmaAccount: account,
        status: 'UNMATCHED_FIRMA',
        matchScore: 0,
        difference: round2(-account.balance),
        debitDifference: round2(-account.totalDebit),
        creditDifference: round2(-account.totalCredit),
        transactionSummary: {
            smmmTotal: 0,
            firmaTotal: comparable.length,
            matched: 0,
            onlyInSmmm: 0,
            onlyInFirma: comparable.length,
        },
        transactionDiffRows: [],
        unmatchedSmmmTransactions: [],
        unmatchedFirmaTransactions: comparable,
    };
};

export const runComparison = (
    smmmData: AccountDetail[],
    firmaData: AccountDetail[],
    manualMatches: Record<string, string> = {}
): ComparisonResult[] => {
    const smmmAccounts = smmmData.filter(isTargetAccount);
    const firmaAccounts = firmaData.filter(isTargetAccount);

    const usedFirmaIndices = new Set<number>();
    const results: ComparisonResult[] = [];

    smmmAccounts.forEach((smmmAccount) => {
        let bestIndex = -1;
        let bestScore = 0;
        let isManual = false;

        const manualFirmaCode = manualMatches[smmmAccount.code];
        if (manualFirmaCode) {
            const forcedIndex = firmaAccounts.findIndex(
                (firmaAccount, index) => !usedFirmaIndices.has(index) && firmaAccount.code === manualFirmaCode
            );
            if (forcedIndex >= 0) {
                bestIndex = forcedIndex;
                bestScore = 100;
                isManual = true;
            }
        }

        if (!isManual) {
            firmaAccounts.forEach((firmaAccount, index) => {
                if (usedFirmaIndices.has(index)) return;
                const score = calculateNameSimilarity(smmmAccount.name, firmaAccount.name);
                if (score > bestScore) {
                    bestScore = score;
                    bestIndex = index;
                }
            });
        }

        if (bestIndex === -1 || bestScore < NAME_MATCH_THRESHOLD) {
            const manualNote = manualFirmaCode ? `Manuel eslestirme hedefi bulunamadi: ${manualFirmaCode}` : undefined;
            results.push(buildUnmatchedSmmmResult(smmmAccount, manualNote));
            return;
        }

        const firmaAccount = firmaAccounts[bestIndex];
        usedFirmaIndices.add(bestIndex);

        const transactionDetail = compareTransactions(smmmAccount.transactions, firmaAccount.transactions);
        const balanceDiff = round2(smmmAccount.balance - firmaAccount.balance);
        const debitDiff = round2(smmmAccount.totalDebit - firmaAccount.totalDebit);
        const creditDiff = round2(smmmAccount.totalCredit - firmaAccount.totalCredit);

        // Business rule: if balance difference is within tolerance, do not treat as erroneous
        // even when row/debit/credit details differ.
        const isBalanceAligned = Math.abs(balanceDiff) <= TOLERANCE;
        const status: MatchStatus = isBalanceAligned ? 'MATCHED' : 'DIFFERENCE';

        results.push({
            id: uuidv4(),
            smmmAccount,
            firmaAccount,
            status,
            matchScore: Math.round(bestScore * 100),
            isManual,
            difference: balanceDiff,
            debitDifference: debitDiff,
            creditDifference: creditDiff,
            transactionSummary: transactionDetail.summary,
            transactionDiffRows: transactionDetail.diffRows,
            unmatchedSmmmTransactions: transactionDetail.unmatchedSmmmTransactions,
            unmatchedFirmaTransactions: transactionDetail.unmatchedFirmaTransactions,
        });
    });

    firmaAccounts.forEach((firmaAccount, index) => {
        if (usedFirmaIndices.has(index)) return;
        results.push(buildUnmatchedFirmaResult(firmaAccount));
    });

    results.sort((left, right) => {
        const statusOrder: Record<MatchStatus, number> = {
            DIFFERENCE: 0,
            UNMATCHED_SMMM: 1,
            UNMATCHED_FIRMA: 2,
            MATCHED: 3,
        };

        const orderDiff = statusOrder[left.status] - statusOrder[right.status];
        if (orderDiff !== 0) return orderDiff;

        const leftName = left.smmmAccount?.name || left.firmaAccount?.name || '';
        const rightName = right.smmmAccount?.name || right.firmaAccount?.name || '';
        return leftName.localeCompare(rightName, 'tr-TR');
    });

    return results;
};
