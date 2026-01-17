// Simple CSV export wrapper that works with EInvoiceRow/AccountingRow
export const createDemoData = (type: 'EINVOICE' | 'ACCOUNTING') => {
    if (type === 'EINVOICE') {
        return [
            { "Fatura Tarihi": "2023-10-01", "Fatura No": "ABC2023000000001", "KDV Tutarı": "180.00", "GİB Fatura Türü": "SATIS", "Ödeme Şekli": "HAVALE", "Para Birimi": "TRY", "Müşteri": "Müşteri A", "Statü": "ONAYLANDI", "Geçerlilik Durumu": "Gecerli" },
            { "Fatura Tarihi": "2023-10-02", "Fatura No": "ABC2023000000002", "KDV Tutarı": "500.25", "GİB Fatura Türü": "SATIS", "Ödeme Şekli": "KREDI", "Para Birimi": "TRY", "Müşteri": "Müşteri B", "Statü": "ONAYLANDI", "Geçerlilik Durumu": "Gecerli" },
            { "Fatura Tarihi": "2023-10-03", "Fatura No": "ABC2023000000003", "KDV Tutarı": "1000.00", "GİB Fatura Türü": "SATIS", "Ödeme Şekli": "HAVALE", "Para Birimi": "TRY", "Müşteri": "Müşteri C", "Statü": "IPTAL", "Geçerlilik Durumu": "Gecersiz" }
        ];
    } else {
        return [
            { "Tarih": "01.10.2023", "Ref.No": "REF001", "Fatura No": "ABC2023000000001", "Açıklama": "Fatura Tahsilatı", "Alacak Tutarı": "180,00" },
            { "Tarih": "02.10.2023", "Ref.No": "REF002", "Fatura No": "", "Açıklama": "Açıklama içinde ABC2023000000002 no'lu fatura", "Alacak Tutarı": "501,00" }, // Difference > 0.25
            { "Tarih": "04.10.2023", "Ref.No": "REF003", "Fatura No": "XYZ2023000000999", "Açıklama": "Muhasebede var e-faturada yok", "Alacak Tutarı": "250,50" }
        ];
    }
};
