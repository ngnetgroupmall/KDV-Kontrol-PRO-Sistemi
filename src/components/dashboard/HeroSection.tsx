import { ArrowRight, PlayCircle } from 'lucide-react';
import { Button } from '../../components/common/Button';

interface HeroSectionProps {
    onStart: () => void;
}

export default function HeroSection({ onStart }: HeroSectionProps) {
    return (
        <section className="relative w-full rounded-3xl overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-800 p-12 mb-8 shadow-2xl animate-fade-in">
            {/* Glow Effect */}
            <div className="absolute top-0 right-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
                {/* Text Content */}
                <div className="flex-1 space-y-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-bold text-blue-400 tracking-wider uppercase">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                        NG NET GROUP SOLUTIONS
                    </div>

                    <div>
                        <h1 className="text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight mb-4">
                            KDV Mutabakat PRO <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                                Artık Çok Daha Kolay.
                            </span>
                        </h1>
                        <p className="text-lg text-slate-400 max-w-xl leading-relaxed">
                            Excel dosyalarınızı modern SaaS gücüyle analiz edin. <br />
                            Kuruluş kurumsal KDV farklarını saniyeler içinde raporlayın.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={onStart}
                            rightIcon={<ArrowRight className="group-hover:translate-x-1 transition-transform" />}
                        >
                            Hemen Başla
                        </Button>
                        <Button
                            variant="secondary"
                            size="lg"
                            leftIcon={<PlayCircle className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />}
                        >
                            Nasıl Çalışır?
                        </Button>
                    </div>
                </div>

                {/* Illustration */}
                <div className="w-full max-w-[500px] relative h-[400px] flex items-center justify-center animate-float">
                    {/* Abstract Stack Logo / Illustration Placeholder */}
                    <div className="relative w-64 h-64">
                        <div className="absolute inset-0 bg-blue-500 blur-[80px] opacity-40 animate-pulse"></div>

                        {/* Stack Layers */}
                        <div className="absolute top-0 left-0 w-64 h-64 z-10 transform -rotate-6 translate-y-4 opacity-50">
                            <div className="w-full h-full bg-gradient-to-tr from-slate-700 to-slate-600 rounded-3xl border border-white/10 shadow-2xl"></div>
                        </div>
                        <div className="absolute top-0 left-0 w-64 h-64 z-20 transform rotate-3 translate-y-2 opacity-80">
                            <div className="w-full h-full bg-gradient-to-tr from-slate-600 to-slate-500 rounded-3xl border border-white/10 shadow-2xl"></div>
                        </div>
                        <div className="absolute top-0 left-0 w-64 h-64 z-30 transform hover:scale-105 transition-transform duration-500">
                            <div className="w-full h-full bg-gradient-to-bl from-blue-600/20 to-cyan-500/20 rounded-3xl border border-white/20 shadow-[0_20px_50px_-12px_rgba(59,130,246,0.3)] flex items-center justify-center backdrop-blur-sm overflow-hidden p-8">
                                <img src="/logo.png" alt="NG NET GROUP" className="w-full h-full object-contain filter drop-shadow-2xl" />
                            </div>
                        </div>

                        {/* Tag */}
                        <div className="absolute -right-12 top-10 z-40 bg-slate-800 border border-slate-700 p-3 rounded-xl shadow-xl animate-float-delayed">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span className="font-bold text-xs text-white">NG NET GROUP</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
