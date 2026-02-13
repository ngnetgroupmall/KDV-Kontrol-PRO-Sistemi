export interface Transaction {
    date: Date | null;
    description: string;
    debit: number;
    credit: number;
    balance?: number;
    voucherNo?: string;
}

export interface AccountDetail {
    code: string;
    name: string;
    vkn?: string;
    totalDebit: number;
    totalCredit: number;
    balance: number;
    transactionCount: number;
    transactions: Transaction[];
}

export interface MappingConfig {
    [key: string]: Record<string, string>;
}





export interface KebirAnalysisResult {
    totalLines: number;
    uniqueAccountCount: number;
    uniqueVoucherCount: number;
    monthlyDensity: { month: number; count: number; volume: number }[];
    topAccounts: { code: string; name: string; count: number; volume: number }[];
    mizan: AccountDetail[];

    totalDebit: number;
    totalCredit: number;
    complexityScore: number;
    keyAccounts: Record<string, { count: number; volume: number }>;
    avgUniqueAccounts: number;
    avgUniqueVouchers: number;
    debugMeta?: {
        headerRowIndex: number;
        detectedColumns: Record<string, number>;
        successRate: string;
        fileName: string;
        dateMethod?: string;
        sampleDates?: string[];
        parsedDateCount?: number;
    };

    // Legacy/optional fields kept for backward compatibility
    totalTransactions?: number;
    totalVolume?: number;
    dateRange?: { start: Date; end: Date };
    accountTypeDistribution?: Record<string, number>;
    rawData?: AccountDetail[];
    processingTime?: number;
}



export interface Company {
    id: string;
    name: string;
    taxNumber?: string;
    createdAt: Date;
    updatedAt: Date;

    // Module Data
    currentAccount?: {
        smmmData: AccountDetail[];
        firmaData: AccountDetail[];
        smmmFullData?: AccountDetail[];
        firmaFullData?: AccountDetail[];
        mappings: MappingConfig;
        manualMatches?: Record<string, string>;
        rowReviews?: Record<string, { corrected: boolean; note?: string; updatedAt?: string }>;
    };

    kebirAnalysis?: KebirAnalysisResult;

    reconciliation?: any;
}
