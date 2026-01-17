export interface EInvoiceRow {
  id: string;
  faturaTarihi: Date | null;
  faturaNo: string;
  kdvTutari: number;
  gibFaturaTuru: string;
  odemeSekli: string;
  paraBirimi: string;
  dovizKuru: number;
  musteri: string;
  statu: string;
  gecerlilikDurumu: string;
  originalRow: any;
}

export interface AccountingRow {
  id: string;
  tarih: Date | null;
  refNo: string;
  faturaNo: string; // Extracted
  aciklama: string;
  alacakTutari: number;
  originalRow: any;
  multipleInvoicesFound?: boolean;
}

export interface MappingConfig {
  [canonicalKey: string]: string; // canonical -> user column name
}

export interface ReconciliationSummary {
  eInvoiceCount: number;
  accountingCount: number;
  matchedCount: number;
  missingInAccounting: number;
  missingInEInvoice: number;
  kdvMismatches: number;
}
