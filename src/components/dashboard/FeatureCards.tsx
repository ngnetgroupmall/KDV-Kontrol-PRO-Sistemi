import { UploadCloud, ShoppingCart, ChevronRight, BarChart, Scale, Calculator, FileClock, FileText, FileSpreadsheet, FileArchive, Database } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';

interface FeatureCardsProps {
    onAction: (action: string) => void;
}

const PRIMARY_MODULES = [
    {
        id: 'sales',
        title: 'Satış KDV Kontrol',
        description: 'E-Fatura, GİB Portal veya Z-Raporu verilerinizi Muhasebe kayıtlarınızla (391 - 600) karşılaştırın.',
        icon: ShoppingCart,
        bgIcon: UploadCloud,
        accentColor: 'blue',
    },
    {
        id: 'purchase',
        title: 'Alış KDV Kontrol',
        description: 'Gelen E-Faturalarınızı Muhasebe (191) hesaplarınızla eşleştirin. Mükerrer ve eksik faturaları tespit edin.',
        icon: ShoppingCart,
        bgIcon: ShoppingCart,
        accentColor: 'purple',
    },
    {
        id: 'kebir',
        title: 'Kebir & Ücret Analizi',
        description: 'Defter-i Kebir dosyanızı yükleyerek firma işlem yoğunluğunu ve hesap dağılımını analiz edin.',
        icon: BarChart,
        bgIcon: BarChart,
        accentColor: 'orange',
    },
];

const SECONDARY_MODULES = [
    {
        id: 'mizan',
        title: 'Mizan',
        description: 'Hesap bakiyelerini kontrol edin, uyumsuzlukları tespit edin.',
        icon: Scale,
        accentColor: 'cyan',
    },
    {
        id: 'temporary-tax',
        title: 'Geçici Vergi',
        description: 'Dönemsel gelir-gider analizi ve vergi hesaplama.',
        icon: Calculator,
        accentColor: 'emerald',
    },
    {
        id: 'current-account',
        title: 'Cari Hesap Kontrol',
        description: 'SMMM ve firma cari hesap ekstrelerini karşılaştırın.',
        icon: FileSpreadsheet,
        accentColor: 'indigo',
    },
    {
        id: 'fatura-xml',
        title: 'Fatura XML',
        description: 'ZIP içindeki e-Fatura XML dosyalarını ayrıştırın ve Excel\'e aktarın.',
        icon: FileArchive,
        accentColor: 'amber',
    },
    {
        id: 'voucher-list',
        title: 'Fiş Listesi',
        description: 'Muhasebe fişlerini gruplandırarak görüntüleyin ve filtreleyin.',
        icon: FileText,
        accentColor: 'pink',
    },
    {
        id: 'voucher-edit-report',
        title: 'Fiş Düzenleme Raporu',
        description: 'Yapılan fiş düzenlemelerini takip edin ve geri alın.',
        icon: FileClock,
        accentColor: 'teal',
    },
    {
        id: 'upload',
        title: 'Veri Yükleme',
        description: 'Tüm dosyalarınızı merkezi yükleme sayfasından yönetin.',
        icon: Database,
        accentColor: 'slate',
    },
];

const ACCENT_MAP: Record<string, { border: string; bg: string; text: string; hoverBorder: string }> = {
    blue: { border: 'border-blue-500/20', bg: 'bg-blue-500/20', text: 'text-blue-400', hoverBorder: 'hover:border-blue-500/50' },
    purple: { border: 'border-purple-500/20', bg: 'bg-purple-500/20', text: 'text-purple-400', hoverBorder: 'hover:border-purple-500/50' },
    orange: { border: 'border-orange-500/20', bg: 'bg-orange-500/20', text: 'text-orange-400', hoverBorder: 'hover:border-orange-500/50' },
    cyan: { border: 'border-cyan-500/20', bg: 'bg-cyan-500/20', text: 'text-cyan-400', hoverBorder: 'hover:border-cyan-500/50' },
    emerald: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/20', text: 'text-emerald-400', hoverBorder: 'hover:border-emerald-500/50' },
    indigo: { border: 'border-indigo-500/20', bg: 'bg-indigo-500/20', text: 'text-indigo-400', hoverBorder: 'hover:border-indigo-500/50' },
    amber: { border: 'border-amber-500/20', bg: 'bg-amber-500/20', text: 'text-amber-400', hoverBorder: 'hover:border-amber-500/50' },
    pink: { border: 'border-pink-500/20', bg: 'bg-pink-500/20', text: 'text-pink-400', hoverBorder: 'hover:border-pink-500/50' },
    teal: { border: 'border-teal-500/20', bg: 'bg-teal-500/20', text: 'text-teal-400', hoverBorder: 'hover:border-teal-500/50' },
    slate: { border: 'border-slate-500/20', bg: 'bg-slate-500/20', text: 'text-slate-400', hoverBorder: 'hover:border-slate-500/50' },
};

export default function FeatureCards({ onAction }: FeatureCardsProps) {
    return (
        <div className="space-y-8">
            {/* Primary Modules */}
            <div>
                <h2 className="text-xl font-bold text-white pl-1 flex items-center gap-2 mb-6">
                    <BarChart className="text-blue-500" size={24} />
                    Ana Modüller
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in">
                    {PRIMARY_MODULES.map((mod) => {
                        const accent = ACCENT_MAP[mod.accentColor];
                        return (
                            <Card key={mod.id} className={`flex flex-col items-start h-full group relative overflow-hidden transition-all duration-300 hover:shadow-2xl ${accent.hoverBorder} ${accent.border}`}>
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <mod.bgIcon size={100} className={accent.text} />
                                </div>

                                <div className={`w-14 h-14 mb-6 rounded-2xl ${accent.bg} border ${accent.border} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                    <mod.icon className={`w-7 h-7 ${accent.text}`} />
                                </div>

                                <h3 className={`text-xl font-bold text-white mb-3 group-hover:${accent.text} transition-colors`}>{mod.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-1">{mod.description}</p>

                                <Button
                                    variant="primary"
                                    onClick={() => onAction(mod.id)}
                                    rightIcon={<ChevronRight size={18} />}
                                    className="w-full justify-between"
                                >
                                    Modülü Başlat
                                </Button>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Secondary Modules */}
            <div>
                <h2 className="text-lg font-bold text-white pl-1 flex items-center gap-2 mb-4">
                    Diğer Araçlar
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
                    {SECONDARY_MODULES.map((mod) => {
                        const accent = ACCENT_MAP[mod.accentColor];
                        return (
                            <button
                                key={mod.id}
                                onClick={() => onAction(mod.id)}
                                className={`text-left p-4 rounded-xl bg-slate-800/50 border ${accent.border} ${accent.hoverBorder} hover:bg-slate-800 transition-all duration-200 group`}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-9 h-9 rounded-lg ${accent.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                        <mod.icon className={`w-5 h-5 ${accent.text}`} />
                                    </div>
                                    <h4 className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">{mod.title}</h4>
                                </div>
                                <p className="text-slate-500 text-xs leading-relaxed">{mod.description}</p>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
