import type { EInvoiceRow, AccountingRow, AccountingMatrahRow } from '../../types';

export interface Transaction {
    id?: string;
    date: Date | null;
    description: string;
    debit: number;
    credit: number;
    balance?: number;
    voucherNo?: string;
    documentNo?: string;
    currencyCode?: string;
    exchangeRate?: number;
    fxDebit?: number;
    fxCredit?: number;
    fxBalance?: number;
    fxBalanceManual?: boolean;
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

export type VoucherEditSource = 'FIRMA' | 'SMMM';

export interface VoucherEditLogEntry {
    id: string;
    createdAt: string;
    source: VoucherEditSource;
    transactionId?: string;
    referenceLogId?: string;
    undoneAt?: string;
    undoLogId?: string;
    voucherNo: string;
    accountCodeBefore: string;
    accountNameBefore: string;
    accountCodeAfter: string;
    accountNameAfter: string;
    field: string;
    fieldLabel: string;
    oldValue: string;
    newValue: string;
    documentNo?: string;
    description?: string;
}

export interface CurrentAccountParseSummary {
    totalRows: number;
    transactionRows: number;
    accountCount: number;
    filteredByPrefixRows: number;
    skippedNoCodeRows: number;
    skippedNoNameRows: number;
    skippedSummaryRows: number;
    zeroMovementRows: number;
    invalidDateRows: number;
    voucherNoRows: number;
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

export interface FaturaXmlLineItem {
    itemName: string;
    quantity: number | string;
    unitPrice: number | string;
    taxPercent: number | string;
    taxAmount: number | string;
    lineTotal: number | string;
}

export interface FaturaXmlInvoice {
    id: string;
    invNo: string;
    invDate: string;
    companyName: string;
    supplierName: string;
    supplierVN: string;
    customerName: string;
    customerVN: string;
    taxExclusiveAmount: number | string;
    taxAmount: number | string;
    taxInclusiveAmount: number | string;
    currency: string;
    totalAmountLabel: string;
    lines: FaturaXmlLineItem[];
}

export type FaturaXmlExcelRow = Record<string, string | number | null>;

export interface FaturaXmlModuleData {
    sourceFileName: string;
    processedAt: string;
    invoiceCount: number;
    itemCount: number;
    invoices: FaturaXmlInvoice[];
    excelRows: FaturaXmlExcelRow[];
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
        dataQuality?: {
            smmm?: CurrentAccountParseSummary;
            firma?: CurrentAccountParseSummary;
        };
        forexAccountOverrides?: Record<string, boolean>;
        mizanApprovals?: Record<string, boolean>;
        accountStatementRowApprovals?: Record<string, boolean>;
        voucherEditLogs?: VoucherEditLogEntry[];
        temporaryTaxPriorYearLoss?: number;
        mappings: MappingConfig;
        manualMatches?: Record<string, string>;
        rowReviews?: Record<string, { corrected: boolean; note?: string; updatedAt?: string }>;
    };

    kebirAnalysis?: KebirAnalysisResult;

    reconciliation?: {
        eInvoiceData?: EInvoiceRow[];
        accountingData?: AccountingRow[];
        accountingMatrahData?: AccountingMatrahRow[];

        reports?: {
            report1: Record<string, string | number | Date | null>[];
            report2: Record<string, string | number | Date | null>[];
            report3: Record<string, string | number | Date | null>[];
            report4?: Record<string, string | number | Date | null>[];
        };
        [key: string]: unknown;
    };

    faturaXml?: FaturaXmlModuleData;
}
