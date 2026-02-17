// SALES E-Invoice fields - Matrah is required for sales
export const SALES_EINVOICE_FIELDS = [
    { key: 'Fatura Tarihi', label: 'Fatura Tarihi', required: true },
    { key: 'Fatura No', label: 'Fatura No', required: true },
    { key: 'VKN', label: 'VKN / TCKN', required: false },
    { key: 'Matrah', label: 'Mal Hizmet Tutarı (Matrah)', required: true },
    { key: 'KDV Tutarı', label: 'KDV Tutarı', required: true },
    { key: 'GİB Fatura Türü', label: 'GİB Fatura Türü', required: false },
    { key: 'Ödeme Şekli', label: 'Ödeme Şekli', required: false },
    { key: 'Para Birimi', label: 'Para Birimi', required: false },
    { key: 'Döviz Kuru', label: 'Döviz Kuru', required: false },
    { key: 'Müşteri', label: 'Müşteri', required: false },
    { key: 'Statü', label: 'Statü', required: false },
    { key: 'Geçerlilik Durumu', label: 'Geçerlilik Durumu', required: false }
];

// PURCHASE E-Invoice fields - Matrah kontrolü alış için yapılmıyor
export const PURCHASE_EINVOICE_FIELDS = [
    { key: 'Fatura Tarihi', label: 'Fatura Tarihi', required: true },
    { key: 'Fatura No', label: 'Fatura No', required: true },
    { key: 'VKN', label: 'VKN / TCKN', required: false },
    { key: 'KDV Tutarı', label: 'KDV Tutarı', required: true },
    { key: 'GİB Fatura Türü', label: 'GİB Fatura Türü', required: false },
    { key: 'Ödeme Şekli', label: 'Ödeme Şekli', required: false },
    { key: 'Para Birimi', label: 'Para Birimi', required: false },
    { key: 'Döviz Kuru', label: 'Döviz Kuru', required: false },
    { key: 'Müşteri', label: 'Müşteri', required: false },
    { key: 'Statü', label: 'Statü', required: false },
    { key: 'Geçerlilik Durumu', label: 'Geçerlilik Durumu', required: false }
];

// SALES (Default)
export const SALES_ACCOUNTING_VAT_FIELDS = [
    { key: 'Tarih', label: 'Tarih', required: true },
    { key: 'Ref.No', label: 'Ref.No', required: false },
    { key: 'Fatura No', label: 'Fatura No', required: true },
    { key: 'VKN', label: 'VKN / TCKN', required: false },
    { key: 'Açıklama', label: 'Açıklama', required: false },
    { key: 'Alacak Tutarı', label: 'KDV Tutarı (Alacak)', required: true }
];

// PURCHASE - Matrah kontrolü alış için yapılmıyor
export const PURCHASE_ACCOUNTING_VAT_FIELDS = [
    { key: 'Tarih', label: 'Tarih', required: true },
    { key: 'Ref.No', label: 'Ref.No', required: false },
    { key: 'Fatura No', label: 'Fatura No', required: true },
    { key: 'VKN', label: 'VKN / TCKN', required: false },
    { key: 'Açıklama', label: 'Açıklama', required: false },
    { key: 'Borç Tutarı', label: 'KDV Tutarı (Borç)', required: true }
];

// SALES Matrah fields - only used for sales, not purchases
export const ACCOUNTING_MATRAH_FIELDS = [
    { key: 'Tarih', label: 'Tarih', required: true },
    { key: 'Ref.No', label: 'Ref.No', required: false },
    { key: 'Fatura No', label: 'Fatura No', required: true },
    { key: 'VKN', label: 'VKN / TCKN', required: false },
    { key: 'Açıklama', label: 'Açıklama', required: false },
    { key: 'Matrah', label: 'Matrah Tutarı (Borç/Alacak)', required: true }
];
