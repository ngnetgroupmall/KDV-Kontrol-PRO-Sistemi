import type { ComparableTransaction, ComparisonResult, TransactionReviewMap } from './types';

export type ReviewSide = 'SMMM' | 'FIRMA';

const toCents = (value: number): number => Math.round((value + Number.EPSILON) * 100);

export const getAccountScopeKey = (result: ComparisonResult): string => {
    const smmmCode = result.smmmAccount?.code || 'NONE';
    const firmaCode = result.firmaAccount?.code || 'NONE';
    return `${smmmCode}::${firmaCode}`;
};

export const buildReviewKey = (
    accountScopeKey: string,
    side: ReviewSide,
    row: ComparableTransaction,
    index: number
): string => {
    return `${accountScopeKey}|${side}|${row.date}|${toCents(row.debit)}|${toCents(row.credit)}|${index}`;
};

export const countCorrectedRows = (
    rows: ComparableTransaction[],
    side: ReviewSide,
    accountScopeKey: string,
    rowReviews: TransactionReviewMap
): number => {
    return rows.reduce((count, row, index) => {
        const review = rowReviews[buildReviewKey(accountScopeKey, side, row, index)];
        return review?.corrected ? count + 1 : count;
    }, 0);
};

export const getResultReviewSummary = (
    result: ComparisonResult,
    rowReviews: TransactionReviewMap
): { totalIssues: number; correctedIssues: number; allIssuesCorrected: boolean } => {
    const totalIssues = result.transactionSummary.onlyInSmmm + result.transactionSummary.onlyInFirma;
    const accountScopeKey = getAccountScopeKey(result);

    const correctedIssues =
        countCorrectedRows(result.unmatchedSmmmTransactions, 'SMMM', accountScopeKey, rowReviews) +
        countCorrectedRows(result.unmatchedFirmaTransactions, 'FIRMA', accountScopeKey, rowReviews);

    const allIssuesCorrected = totalIssues > 0 && correctedIssues >= totalIssues;

    return {
        totalIssues,
        correctedIssues,
        allIssuesCorrected,
    };
};
