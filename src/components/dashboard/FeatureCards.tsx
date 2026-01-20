import { UploadCloud, ShoppingCart, Lock, ChevronRight, BarChart } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';

interface FeatureCardsProps {
    onAction: (action: string) => void;
}

export default function FeatureCards({ onAction }: FeatureCardsProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-white pl-1 flex items-center gap-2">
                <BarChart className="text-blue-500" size={24} />
                Sisteme Dahil Modüller
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in">
                {/* Sale Control Module */}
                <Card className="flex flex-col items-start h-full group relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:border-blue-500/50 border-blue-500/20">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <UploadCloud size={100} className="text-blue-500" />
                    </div>

                    <div className="w-14 h-14 mb-6 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <ShoppingCart className="w-7 h-7 text-blue-400" />
                    </div>

                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-blue-400 transition-colors">Satış KDV Kontrol</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-1">
                        E-Fatura, GİB Portal veya Z-Raporu verilerinizi Muhasebe kayıtlarınızla (391 - 600) karşılaştırın.
                        Matrah ve KDV uyumsuzluklarını anında bulun.
                    </p>

                    <Button
                        variant="primary"
                        onClick={() => onAction('upload')}
                        rightIcon={<ChevronRight size={18} />}
                        className="w-full justify-between"
                    >
                        Modülü Başlat
                    </Button>
                </Card>

                {/* Purchase Control Module (Placeholder) */}
                <Card className="flex flex-col items-start h-full relative overflow-hidden bg-slate-800/20 border-slate-800 opacity-60">
                    <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Yakında
                    </div>

                    <div className="w-14 h-14 mb-6 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                        <Lock className="w-6 h-6 text-slate-500" />
                    </div>

                    <h3 className="text-xl font-bold text-slate-300 mb-3">Alış KDV Kontrol</h3>
                    <p className="text-slate-500 text-sm leading-relaxed mb-8 flex-1">
                        Gelen E-Faturalarınızı Muhasebe (191) hesaplarınızla eşleştirin.
                        Mükerrer kayıtları ve eksik faturaları tespit edin.
                    </p>

                    <Button
                        variant="ghost"
                        disabled
                        className="w-full justify-start cursor-not-allowed text-slate-500"
                    >
                        Hazırlanıyor...
                    </Button>
                </Card>
            </div>
        </div>
    );
}
