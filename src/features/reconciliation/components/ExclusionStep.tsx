import { useState, useEffect } from 'react';
import { Check, ShieldX, ArrowRight, AlertCircle, Search } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { cn } from '../../../components/common/Button';

interface ExclusionStepProps {
    data: any[];
    onComplete: (excludedStatuses: string[], excludedValidities: string[]) => void;
    onBack: () => void;
}

export function ExclusionStep({ data, onComplete, onBack }: ExclusionStepProps) {
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
        <div className="animate-fade-in max-w-5xl mx-auto">
            <Card className="p-8">
                {/* Header */}
                <div className="flex items-center gap-6 mb-8 pb-6 border-b border-slate-800">
                    <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 shrink-0">
                        <ShieldX className="w-8 h-8 text-amber-500" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-2xl font-bold text-white">Hariç Tutulacak Faturalar</h3>
                        <p className="text-slate-400">İptal/Geçersiz faturaları karşılaştırmadan çıkararak daha doğru sonuçlar elde edin.</p>
                    </div>
                    <div className="text-right bg-red-500/10 px-6 py-4 rounded-xl border border-red-500/20">
                        <p className="text-4xl font-black text-red-500">{excludedCount}</p>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Hariç Tutulacak</p>
                    </div>
                </div>

                {/* Simple Instructions */}
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 mb-8 flex items-start gap-3">
                    <AlertCircle className="text-blue-500 w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-300">
                        <span className="text-blue-400 font-bold">Nasıl Kullanılır?</span> Aşağıdaki listelerden işaretlediğiniz değerlere sahip faturalar analiz raporuna dahil edilmeyecektir.
                        Sistem "İPTAL" ve "RED" içeren değerleri sizin için otomatik olarak seçmiştir.
                    </p>
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    {/* Status Column */}
                    <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
                        <div className="flex items-center justify-between mb-4 px-2">
                            <h4 className="font-bold text-lg text-white">📋 Statü Değerleri</h4>
                            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded font-mono">{uniqueStatuses.length}</span>
                        </div>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {uniqueStatuses.map(s => (
                                <div
                                    key={s}
                                    onClick={() => toggleStatus(s)}
                                    className={cn(
                                        "flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all border-2 group",
                                        excludedStatuses.has(s)
                                            ? 'bg-red-500/10 border-red-500/40'
                                            : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                                    )}
                                >
                                    <div className={cn(
                                        "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                                        excludedStatuses.has(s) ? "bg-red-500 border-red-500" : "border-slate-500"
                                    )}>
                                        {excludedStatuses.has(s) && <Check size={14} className="text-white" strokeWidth={3} />}
                                    </div>
                                    <span className={cn("font-medium flex-1 text-sm", excludedStatuses.has(s) ? "text-white" : "text-slate-400")}>{s}</span>
                                    {excludedStatuses.has(s) && (
                                        <span className="text-[10px] bg-red-500/20 text-red-500 px-2 py-1 rounded-full font-bold">HARİÇ</span>
                                    )}
                                </div>
                            ))}
                            {uniqueStatuses.length === 0 && (
                                <div className="text-center p-8 text-slate-500">
                                    <Search size={24} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Statü verisi bulunamadı.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Validity Column */}
                    <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
                        <div className="flex items-center justify-between mb-4 px-2">
                            <h4 className="font-bold text-lg text-white">✅ Geçerlilik Durumu</h4>
                            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded font-mono">{uniqueValidities.length}</span>
                        </div>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {uniqueValidities.map(v => (
                                <div
                                    key={v}
                                    onClick={() => toggleValidity(v)}
                                    className={cn(
                                        "flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all border-2 group",
                                        excludedValidities.has(v)
                                            ? 'bg-red-500/10 border-red-500/40'
                                            : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                                    )}
                                >
                                    <div className={cn(
                                        "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                                        excludedValidities.has(v) ? "bg-red-500 border-red-500" : "border-slate-500"
                                    )}>
                                        {excludedValidities.has(v) && <Check size={14} className="text-white" strokeWidth={3} />}
                                    </div>
                                    <span className={cn("font-medium flex-1 text-sm", excludedValidities.has(v) ? "text-white" : "text-slate-400")}>{v}</span>
                                    {excludedValidities.has(v) && (
                                        <span className="text-[10px] bg-red-500/20 text-red-500 px-2 py-1 rounded-full font-bold">HARİÇ</span>
                                    )}
                                </div>
                            ))}
                            {uniqueValidities.length === 0 && (
                                <div className="text-center p-8 text-slate-500">
                                    <Search size={24} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Geçerlilik verisi bulunamadı.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center pt-8 border-t border-slate-800">
                    <Button variant="ghost" onClick={onBack}>
                        Geri Dön
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => onComplete([...excludedStatuses], [...excludedValidities])}
                        rightIcon={<ArrowRight size={18} />}
                    >
                        Onayla ve Devam Et
                    </Button>
                </div>
            </Card>
        </div>
    );
}
