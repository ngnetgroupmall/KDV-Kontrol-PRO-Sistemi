import { UploadCloud, Zap, FileBarChart, ChevronRight } from 'lucide-react';

interface FeatureCardsProps {
    onAction: (action: string) => void;
}

export default function FeatureCards({ onAction }: FeatureCardsProps) {
    const cards = [
        {
            id: 'upload',
            title: 'Hızlı Yükleme',
            desc: 'GİB Portal ve Muhasebe kayıtlarını saniyeler içinde sisteme aktarın.',
            icon: UploadCloud,
            color: 'blue',
            btnText: 'Yükleme Yap'
        },
        {
            id: 'reconciliation',
            title: 'Akıllı Ayrıştırma',
            desc: 'Karmaşık açıklamalardan fatura numaralarını otomatik olarak cımbızlayın.',
            icon: Zap,
            color: 'cyan',
            btnText: 'Ayrıştırmayı Başlat'
        },
        {
            id: 'reports',
            title: 'Detaylı Rapor',
            desc: 'Tüm farkları ve hatalı kayıtları kategoriye edilmiş Excel dökümü olarak alın.',
            icon: FileBarChart,
            color: 'indigo',
            btnText: 'Raporu Görüntüle'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {cards.map((card, idx) => (
                <div
                    key={card.id}
                    className="glass-card p-8 flex flex-col items-start h-full group relative overflow-hidden"
                    style={{ animationDelay: `${idx * 150}ms` }}
                >
                    {/* Ambient Light */}
                    <div className={`absolute -right-20 -top-20 w-40 h-40 bg-${card.color}-500/10 rounded-full blur-3xl group-hover:bg-${card.color}-500/20 transition-all duration-500`}></div>

                    <div className={`w-14 h-14 mb-6 rounded-2xl bg-${card.color}-500/10 border border-${card.color}-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                        <card.icon className={`w-7 h-7 text-${card.color}-400 group-hover:text-${card.color}-300 transition-colors`} />
                    </div>

                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-blue-400 transition-colors">{card.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-1">
                        {card.desc}
                    </p>

                    <button
                        onClick={() => onAction(card.id)}
                        className="w-full py-4 px-6 rounded-xl bg-slate-800 border border-white/5 hover:bg-slate-700/80 hover:border-white/10 transition-all flex items-center justify-between group/btn"
                    >
                        <span className="font-bold text-sm text-slate-300 group-hover/btn:text-white transition-colors">{card.btnText}</span>
                        <ChevronRight size={18} className="text-slate-500 group-hover/btn:text-blue-400 group-hover/btn:translate-x-1 transition-all" />
                    </button>
                </div>
            ))}
        </div>
    );
}
