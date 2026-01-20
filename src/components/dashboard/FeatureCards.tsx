import { UploadCloud, Zap, FileBarChart, ChevronRight } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';

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
            bgClass: 'bg-blue-500/10',
            borderClass: 'border-blue-500/20',
            iconClass: 'text-blue-400',
            hoverClass: 'group-hover:text-blue-400',
            btnText: 'Yükleme Yap'
        },
        {
            id: 'reconciliation',
            title: 'Akıllı Ayrıştırma',
            desc: 'Karmaşık açıklamalardan fatura numaralarını otomatik olarak cımbızlayın.',
            icon: Zap,
            bgClass: 'bg-cyan-500/10',
            borderClass: 'border-cyan-500/20',
            iconClass: 'text-cyan-400',
            hoverClass: 'group-hover:text-cyan-400',
            btnText: 'Ayrıştırmayı Başlat'
        },
        {
            id: 'reports',
            title: 'Detaylı Rapor',
            desc: 'Tüm farkları ve hatalı kayıtları kategoriye edilmiş Excel dökümü olarak alın.',
            icon: FileBarChart,
            bgClass: 'bg-indigo-500/10',
            borderClass: 'border-indigo-500/20',
            iconClass: 'text-indigo-400',
            hoverClass: 'group-hover:text-indigo-400',
            btnText: 'Raporu Görüntüle'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in">
            {cards.map((card) => (
                <Card
                    key={card.id}
                    className="flex flex-col items-start h-full group relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:border-blue-500/30"
                >
                    <div className={`w-14 h-14 mb-6 rounded-2xl ${card.bgClass} ${card.borderClass} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border`}>
                        <card.icon className={`w-7 h-7 ${card.iconClass} transition-colors`} />
                    </div>

                    <h3 className={`text-xl font-bold text-white mb-3 ${card.hoverClass} transition-colors`}>{card.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-1">
                        {card.desc}
                    </p>

                    <Button
                        variant="secondary"
                        onClick={() => onAction(card.id)}
                        rightIcon={<ChevronRight size={18} />}
                        className="justify-between group/btn w-full"
                    >
                        {card.btnText}
                    </Button>
                </Card>
            ))}
        </div>
    );
}
