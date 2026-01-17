import { useState, useEffect } from 'react';
import { Check, ShieldX, ArrowRight } from 'lucide-react';

interface Props {
    data: any[];
    onComplete: (excludedStatuses: string[], excludedValidities: string[]) => void;
    onBack: () => void;
}

export default function ExclusionSettings({ data, onComplete, onBack }: Props) {
    const [uniqueStatuses, setUniqueStatuses] = useState<string[]>([]);
    const [uniqueValidities, setUniqueValidities] = useState<string[]>([]);
    const [excludedStatuses, setExcludedStatuses] = useState<Set<string>>(new Set());
    const [excludedValidities, setExcludedValidities] = useState<Set<string>>(new Set());

    useEffect(() => {
        const statuses = new Set<string>();
        const validities = new Set<string>();

        data.forEach(row => {
            const s = row["Statü"];
            const v = row["Geçerlilik Durumu"];
            if (s) statuses.add(s);
            if (v) validities.add(v);
        });

        setUniqueStatuses([...statuses].sort());
        setUniqueValidities([...validities].sort());

        // Auto-select common cancellation keywords
        const cancelKeywords = ['İPTAL', 'IPTAL', 'RED', 'REDDEDILDI', 'GEÇERSİZ', 'GECERSIZ'];
        const autoExcludedStatuses = new Set<string>();
        const autoExcludedValidities = new Set<string>();

        [...statuses].forEach(s => {
            if (cancelKeywords.some(k => s.toUpperCase().includes(k))) {
                autoExcludedStatuses.add(s);
            }
        });
        [...validities].forEach(v => {
            if (cancelKeywords.some(k => v.toUpperCase().includes(k))) {
                autoExcludedValidities.add(v);
            }
        });

        setExcludedStatuses(autoExcludedStatuses);
        setExcludedValidities(autoExcludedValidities);
    }, [data]);

    const toggleStatus = (s: string) => {
        const newSet = new Set(excludedStatuses);
        if (newSet.has(s)) newSet.delete(s);
        else newSet.add(s);
        setExcludedStatuses(newSet);
    };

    const toggleValidity = (v: string) => {
        const newSet = new Set(excludedValidities);
        if (newSet.has(v)) newSet.delete(v);
        else newSet.add(v);
        setExcludedValidities(newSet);
    };

    const excludedCount = data.filter(row =>
        excludedStatuses.has(row["Statü"]) || excludedValidities.has(row["Geçerlilik Durumu"])
    ).length;

    return (
        <div className="wizard-step">
            <div className="card glass">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/10">
                    <div className="w-14 h-14 bg-warning/10 rounded-2xl flex items-center justify-center border border-warning/20">
                        <ShieldX className="w-7 h-7 text-warning" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-2xl font-bold">Hariç Tutulacak Faturalar</h3>
                        <p className="text-text-muted">İptal/Geçersiz faturaları karşılaştırmadan çıkarın.</p>
                    </div>
                    <div className="text-right bg-error/10 px-6 py-3 rounded-xl border border-error/20">
                        <p className="text-3xl font-black text-error">{excludedCount}</p>
                        <p className="text-text-muted text-sm">Hariç Tutulacak</p>
                    </div>
                </div>

                {/* Simple Instructions */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
                    <p className="text-sm text-text-muted">
                        <span className="text-primary font-bold">İpucu:</span> Aşağıda işaretlediğiniz değerlere sahip faturalar karşılaştırmaya <span className="text-error font-bold">dahil edilmeyecek</span>.
                        "İPTAL" ve "RED" içeren değerler otomatik seçilmiştir.
                    </p>
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-2 gap-6 mb-8">
                    {/* Status Column */}
                    <div>
                        <h4 className="font-bold text-lg mb-4">📋 Statü Değerleri</h4>
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                            {uniqueStatuses.map(s => (
                                <label
                                    key={s}
                                    className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border-2 ${excludedStatuses.has(s)
                                        ? 'bg-error/10 border-error/40'
                                        : 'bg-bg-main border-border hover:border-primary/30'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={excludedStatuses.has(s)}
                                        onChange={() => toggleStatus(s)}
                                    />
                                    <span className="font-medium flex-1">{s}</span>
                                    {excludedStatuses.has(s) && (
                                        <span className="text-xs bg-error/20 text-error px-2 py-1 rounded-full font-bold">HARİÇ</span>
                                    )}
                                </label>
                            ))}
                            {uniqueStatuses.length === 0 && (
                                <p className="text-text-muted text-sm italic p-4">Statü verisi bulunamadı.</p>
                            )}
                        </div>
                    </div>

                    {/* Validity Column */}
                    <div>
                        <h4 className="font-bold text-lg mb-4">✅ Geçerlilik Durumu</h4>
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                            {uniqueValidities.map(v => (
                                <label
                                    key={v}
                                    className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border-2 ${excludedValidities.has(v)
                                        ? 'bg-error/10 border-error/40'
                                        : 'bg-bg-main border-border hover:border-primary/30'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={excludedValidities.has(v)}
                                        onChange={() => toggleValidity(v)}
                                    />
                                    <span className="font-medium flex-1">{v}</span>
                                    {excludedValidities.has(v) && (
                                        <span className="text-xs bg-error/20 text-error px-2 py-1 rounded-full font-bold">HARİÇ</span>
                                    )}
                                </label>
                            ))}
                            {uniqueValidities.length === 0 && (
                                <p className="text-text-muted text-sm italic p-4">Geçerlilik verisi bulunamadı.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Summary Bar */}
                <div className="bg-gradient-to-r from-success/10 to-primary/10 rounded-xl p-5 mb-8 border border-success/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-bold text-lg">
                                Karşılaştırmaya <span className="text-success">{data.length - excludedCount}</span> fatura dahil edilecek
                            </p>
                            <p className="text-text-muted text-sm">Toplam {data.length} faturadan {excludedCount} tanesi hariç tutulacak.</p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center pt-6 border-t border-white/10">
                    <button onClick={onBack} className="btn-secondary flex items-center gap-2">
                        ← Geri
                    </button>
                    <button
                        onClick={() => onComplete([...excludedStatuses], [...excludedValidities])}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Check size={18} /> Onayla ve Devam Et <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
