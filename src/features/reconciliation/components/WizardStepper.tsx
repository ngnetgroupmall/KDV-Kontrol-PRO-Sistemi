import { Check } from 'lucide-react';
import { cn } from '../../../components/common/Button';

interface WizardStepperProps {
    currentStep: number;
}

export function WizardStepper({ currentStep }: WizardStepperProps) {
    const steps = [
        { number: 1, label: 'Dosya Yükleme' },
        { number: 2, label: 'Sütun Eşleştirme' },
        { number: 3, label: 'Filtreleme' },
        { number: 4, label: 'Analiz' },
        { number: 5, label: 'Sonuçlar' }
    ];

    return (
        <div className="w-full max-w-4xl mx-auto mb-12">
            <div className="relative flex items-center justify-between">
                {/* Connector Line */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-800 -z-10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-600 transition-all duration-500 ease-out"
                        style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                    ></div>
                </div>

                {steps.map((step) => {
                    const isCompleted = currentStep > step.number;
                    const isCurrent = currentStep === step.number;

                    return (
                        <div key={step.number} className="flex flex-col items-center gap-2 bg-[var(--bg-dark)] px-2">
                            <div
                                className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-4",
                                    isCompleted
                                        ? "bg-blue-600 border-blue-600 text-white"
                                        : isCurrent
                                            ? "bg-[var(--bg-dark)] border-blue-600 text-blue-500 scale-110 shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                                            : "bg-slate-800 border-slate-700 text-slate-500"
                                )}
                            >
                                {isCompleted ? <Check size={18} /> : step.number}
                            </div>
                            <span
                                className={cn(
                                    "text-xs font-semibold uppercase tracking-wider transition-colors duration-300 absolute -bottom-8 w-32 text-center",
                                    isCurrent ? "text-blue-400" : isCompleted ? "text-slate-400" : "text-slate-600"
                                )}
                            >
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
