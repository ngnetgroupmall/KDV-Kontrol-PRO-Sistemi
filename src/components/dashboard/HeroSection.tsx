import { ArrowRight, CheckCircle2, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/common/Button';

interface HeroSectionProps {
    onStart: (mode: 'SALES' | 'PURCHASE') => void;
}

export default function HeroSection({ onStart }: HeroSectionProps) {
    return (
        <section className="relative w-full rounded-3xl overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-800 p-8 lg:p-12 mb-8 shadow-2xl animate-fade-in text-left">
            {/* Glow Effect */}
            <div className="absolute top-0 right-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12">
                {/* Text Content */}
                <div className="flex-1 space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-bold text-blue-400 tracking-wider uppercase">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                        YENİ NESİL MUTABAKAT
                    </div>

                    <div>
                        <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight mb-4">
                            KDV Kontrol PRO <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                                Muhasebenizi Otomatize Edin.
                            </span>
                        </h1>
                        <p className="text-lg text-slate-400 max-w-xl leading-relaxed">
                            E-Fatura ve muhasebe kayıtlarınızı saniyeler içinde karşılaştırın.
                            KDV farklarını, matrah uyumsuzluklarını ve kayıp faturaları anında tespit edin.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        {['Çift Yönlü Kontrol', 'Ayrı Matrah Dosyası', 'Otomatik Raporlama', 'Excel Entegrasyonu'].map((feature) => (
                            <div key={feature} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 text-sm text-slate-300">
                                <CheckCircle2 size={14} className="text-emerald-500" />
                                {feature}
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 flex items-center gap-4">
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={() => onStart('SALES')}
                            rightIcon={<ArrowRight className="group-hover:translate-x-1 transition-transform" />}
                        >
                            Satış Kontrolü Başlat
                        </Button>
                        <Button
                            variant="secondary" // Assuming a secondary variant exists, otherwise use primary with different style or outline
                            size="lg"
                            onClick={() => onStart('PURCHASE')}
                            className="bg-purple-600/20 text-purple-300 border-purple-500/30 hover:bg-purple-600/30 hover:border-purple-500/50"
                            rightIcon={<ArrowRight className="group-hover:translate-x-1 transition-transform" />}
                        >
                            Alış Kontrolü Başlat
                        </Button>
                    </div>
                </div>

                {/* Info Cards / Illustration */}
                <div className="w-full lg:w-auto flex flex-col gap-4 min-w-[300px]">
                    <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-sm flex items-start gap-4 hover:border-blue-500/30 transition-colors">
                        <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
                            <FileSpreadsheet size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-white text-sm">Kolay Veri Yükleme</h4>
                            <p className="text-xs text-slate-400 mt-1 max-w-[200px]">E-Fatura, KDV ve Matrah dosyalarınızı sürükleyip bırakın.</p>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-sm flex items-start gap-4 hover:border-emerald-500/30 transition-colors">
                        <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-white text-sm">Gelişmiş Analiz</h4>
                            <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Hata toleransı belirleyerek ince farkları filtreleyin.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
