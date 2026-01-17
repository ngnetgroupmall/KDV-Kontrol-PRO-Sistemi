import React from 'react';
import { Filter, Check, ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';

interface Props {
    data: any[];
    onComplete: (statuses: string[], validities: string[]) => void;
    onBack: () => void;
}

export default function ExclusionSettings({ data, onComplete, onBack }: Props) {
    const [selectedStatuses, setSelectedStatuses] = React.useState<string[]>([]);
    const [selectedValidities, setSelectedValidities] = React.useState<string[]>([]);

    const uniqueStatuses = Array.from(new Set(data.map(r => String(r["Statü"] || 'BELİRSİZ')))).sort();
    const uniqueValidities = Array.from(new Set(data.map(r => String(r["Geçerlilik Durumu"] || 'BELİRSİZ')))).sort();

    const handleStatusToggle = (s: string) => {
        setSelectedStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    };

    const handleValidityToggle = (v: string) => {
        setSelectedValidities(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
    };

    // Auto-suggest exclusions
    React.useEffect(() => {
        const defaultExclStatuses = uniqueStatuses.filter(s =>
            ['İPTAL', 'RED', 'İADE', 'GEÇERSİZ'].some(k => s.toLocaleUpperCase('tr-TR').includes(k))
        );
        const defaultExclValidities = uniqueValidities.filter(v =>
            ['GEÇERSİZ', 'İPTAL'].some(k => v.toLocaleUpperCase('tr-TR').includes(k))
        );
        setSelectedStatuses(defaultExclStatuses);
        setSelectedValidities(defaultExclValidities);
    }, []);

    const totalExcluded = data.filter(r =>
        selectedStatuses.includes(r["Statü"]) || selectedValidities.includes(r["Geçerlilik Durumu"])
    ).length;

    return (
        <div className="flex flex-col gap-8 animate-slide-up">
            <div className="text-center">
                <h3 className="text-3xl font-bold mb-2">Filtreleme Ayarları</h3>
                <p className="text-text-muted italic">Mutabakat dışı bırakmak istediğiniz durumları seçin.</p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Status Filters */}
                <div className="glass-card p-8">
                    <h4 className="flex items-center gap-3 font-bold mb-6 border-b border-white/5 pb-4">
                        <Filter size={18} className="text-primary-light" />
                        Statü Bazlı Filtrele
                    </h4>
                    <div className="grid gap-2">
                        {uniqueStatuses.map(s => (
                            <label key={s} className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${selectedStatuses.includes(s) ? 'bg-danger/5 border-danger/20 text-danger' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                                <span className="text-sm font-semibold">{s}</span>
                                <input
                                    type="checkbox"
                                    checked={selectedStatuses.includes(s)}
                                    onChange={() => handleStatusToggle(s)}
                                    className="w-5 h-5 rounded border-2 border-white/20 bg-transparent checked:bg-danger checked:border-danger accent-danger"
                                />
                            </label>
                        ))}
                    </div>
                </div>

                {/* Validity Filters */}
                <div className="glass-card p-8">
                    <h4 className="flex items-center gap-3 font-bold mb-6 border-b border-white/5 pb-4">
                        <Check size={18} className="text-success" />
                        Geçerlilik Bazlı Filtrele
                    </h4>
                    <div className="grid gap-2">
                        {uniqueValidities.map(v => (
                            <label key={v} className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${selectedValidities.includes(v) ? 'bg-danger/5 border-danger/20 text-danger' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                                <span className="text-sm font-semibold">{v}</span>
                                <input
                                    type="checkbox"
                                    checked={selectedValidities.includes(v)}
                                    onChange={() => handleValidityToggle(v)}
                                    className="w-5 h-5 rounded border-2 border-white/20 bg-transparent checked:bg-danger checked:border-danger accent-danger"
                                />
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            <div className="glass-card p-6 flex flex-wrap justify-between items-center bg-primary/5 border-primary/10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                        <AlertCircle className="text-primary-light" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Özet Bilgi</p>
                        <p className="font-bold text-sm">
                            <span className="text-danger">{totalExcluded}</span> / {data.length} kayıt mutabakat dışında bırakılacak.
                        </p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={onBack} className="btn-base btn-secondary">
                        <ArrowLeft size={18} /> Geri Dön
                    </button>
                    <button onClick={() => onComplete(selectedStatuses, selectedValidities)} className="btn-base btn-primary px-12">
                        Hesaplamaya Geç <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
