import type { AccountDetail } from '../../common/types';

export type MatchStatus = 'MATCHED' | 'DIFFERENCE' | 'UNMATCHED_SMMM' | 'UNMATCHED_FIRMA';

export interface ComparableTransaction {
    date: string;
    debit: number;
    credit: number;
    balance?: number;
    description?: string;
    voucherNo?: string;
    currencyCode?: string;
    exchangeRate?: number;
    fxDebit?: number;
    fxCredit?: number;
    fxBalance?: number;
}

export interface TransactionDiffRow {
    key: string;
    date: string;
    debit: number;
    credit: number;
    smmmCount: number;
    firmaCount: number;
    matchedCount: number;
    onlyInSmmm: number;
    onlyInFirma: number;
}

export interface TransactionComparisonSummary {
    smmmTotal: number;
    firmaTotal: number;
    matched: number;
    onlyInSmmm: number;
    onlyInFirma: number;
}

export interface TransactionReviewEntry {
    corrected: boolean;
    note?: string;
    updatedAt?: string;
}

export type TransactionReviewMap = Record<string, TransactionReviewEntry>;

export interface ComparisonResult {
    id: string;
    smmmAccount?: AccountDetail;
    firmaAccount?: AccountDetail;
    status: MatchStatus;
    matchScore: number;
    isManual?: boolean;
    difference: number;
    debitDifference: number;
    creditDifference: number;
    transactionSummary: TransactionComparisonSummary;
    transactionDiffRows: TransactionDiffRow[];
    unmatchedSmmmTransactions: ComparableTransaction[];
    unmatchedFirmaTransactions: ComparableTransaction[];
    notes?: string;
}
