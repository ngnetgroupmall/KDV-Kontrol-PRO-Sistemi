import { WizardStepper } from './WizardStepper';
import { UploadStep } from './UploadStep';
import { ReportView } from './ReportView';
import { MappingStep } from './MappingStep';
import { ExclusionStep } from './ExclusionStep';
import { useReconciliation } from '../hooks/useReconciliation';

interface ReconciliationWizardProps {
    recon: ReturnType<typeof useReconciliation>;
    mode: 'SALES' | 'PURCHASE';
}

// SALES E-Invoice fields - Matrah is required for sales
const SALES_EINVOICE_FIELDS = [
    { key: 'Fatura Tarihi', label: 'Fatura Tarihi', required: true },
    { key: 'Fatura No', label: 'Fatura No', required: true },
    { key: 'VKN', label: 'VKN / TCKN', required: false },
    { key: 'Matrah', label: 'Mal Hizmet Tutarı (Matrah)', required: true },
    { key: 'KDV Tutarı', label: 'KDV Tutarı', required: true },
    { key: 'GİB Fatura Türü', label: 'GİB Fatura Türü', required: false },
    { key: 'Ödeme Şekli', label: 'Ödeme Şekli', required: false },
    { key: 'Para Birimi', label: 'Para Birimi', required: false },
    { key: 'Döviz Kuru', label: 'Döviz Kuru', required: false },
    { key: 'Müşteri', label: 'Müşteri', required: false },
    { key: 'Statü', label: 'Statü', required: false },
    { key: 'Geçerlilik Durumu', label: 'Geçerlilik Durumu', required: false }
];

// PURCHASE E-Invoice fields - Matrah kontrolü alış için yapılmıyor
const PURCHASE_EINVOICE_FIELDS = [
    { key: 'Fatura Tarihi', label: 'Fatura Tarihi', required: true },
    { key: 'Fatura No', label: 'Fatura No', required: true },
    { key: 'VKN', label: 'VKN / TCKN', required: false },
    { key: 'KDV Tutarı', label: 'KDV Tutarı', required: true },
    { key: 'GİB Fatura Türü', label: 'GİB Fatura Türü', required: false },
    { key: 'Ödeme Şekli', label: 'Ödeme Şekli', required: false },
    { key: 'Para Birimi', label: 'Para Birimi', required: false },
    { key: 'Döviz Kuru', label: 'Döviz Kuru', required: false },
    { key: 'Müşteri', label: 'Müşteri', required: false },
    { key: 'Statü', label: 'Statü', required: false },
    { key: 'Geçerlilik Durumu', label: 'Geçerlilik Durumu', required: false }
];

// SALES (Default)
const SALES_ACCOUNTING_VAT_FIELDS = [
    { key: 'Tarih', label: 'Tarih', required: true },
    { key: 'Ref.No', label: 'Ref.No', required: false },
    { key: 'Fatura No', label: 'Fatura No', required: true },
    { key: 'VKN', label: 'VKN / TCKN', required: false },
    { key: 'Açıklama', label: 'Açıklama', required: false },
    { key: 'Alacak Tutarı', label: 'KDV Tutarı (Alacak)', required: true }
];

// PURCHASE - Matrah kontrolü alış için yapılmıyor
const PURCHASE_ACCOUNTING_VAT_FIELDS = [
    { key: 'Tarih', label: 'Tarih', required: true },
    { key: 'Ref.No', label: 'Ref.No', required: false },
    { key: 'Fatura No', label: 'Fatura No', required: true },
    { key: 'VKN', label: 'VKN / TCKN', required: false },
    { key: 'Açıklama', label: 'Açıklama', required: false },
    { key: 'Borç Tutarı', label: 'KDV Tutarı (Borç)', required: true }
];

// SALES Matrah fields - only used for sales, not purchases
const ACCOUNTING_MATRAH_FIELDS = [
    { key: 'Tarih', label: 'Tarih', required: true },
    { key: 'Ref.No', label: 'Ref.No', required: false },
    { key: 'Fatura No', label: 'Fatura No', required: true },
    { key: 'VKN', label: 'VKN / TCKN', required: false },
    { key: 'Açıklama', label: 'Açıklama', required: false },
    { key: 'Matrah', label: 'Matrah Tutarı (Borç/Alacak)', required: true }
];

import { useEffect } from 'react';

export function ReconciliationWizard({ recon, mode }: ReconciliationWizardProps) {
    const { state, actions } = recon;

    // Analysis Step
    // Trigger analysis if not already running
    useEffect(() => {
        if (state.step === 5 && !state.loading && !state.reports && !state.error) {
            actions.runReconciliation(mode);
        }
    }, [state.step, mode]);

    if (state.step === 5) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fade-in">
                <div className="relative mb-8">
                    <div className="w-24 h-24 border-4 border-blue-600/30 rounded-full animate-spin"></div>
                    <div className="w-24 h-24 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">{mode === 'SALES' ? 'Satış' : 'Alış'} Kayıtları Analiz Ediliyor...</h2>
                <p className="text-slate-400">Yapay zeka algoritmalarımız kayıtları eşleştiriyor.</p>
            </div>
        );
    }

    // Report Step
    if (state.step === 6 && state.reports) {
        return <ReportView reports={state.reports} onReset={actions.resetAll} />;
    }

    return (
        <div>
            <WizardStepper currentStep={state.step} mode={mode} />

            <div className="mt-8">
                {/* Step 1: E-Invoice Upload & Mapping */}
                {state.step === 1 && (
                    state.eFiles.length === 0 ? (
                        <UploadStep
                            type="EINVOICE"
                            files={state.eFiles}
                            onFilesChange={actions.setEFiles}
                            onNext={() => { }} // Auto handled when files > 0
                            onDemo={() => actions.handleDemoData('EINVOICE')}
                        />
                    ) : (
                        <MappingStep
                            file={state.eFiles[state.currentFileIndex]}
                            canonicalFields={mode === 'SALES' ? SALES_EINVOICE_FIELDS : PURCHASE_EINVOICE_FIELDS}
                            onComplete={(mapping, headerIndex) => actions.processEFile(mapping, headerIndex, mode)}
                            onCancel={() => { actions.setEFiles([]); actions.setStep(1); }}
                        />
                    )
                )}

                {/* Step 2: Exclusion */}
                {state.step === 2 && (
                    <ExclusionStep
                        data={state.eInvoiceData}
                        onComplete={actions.handleExclusionComplete}
                        onBack={() => { actions.setStep(1); actions.setEFiles([]); }}
                    />
                )}

                {/* Step 3: Accounting VAT Upload & Mapping */}
                {state.step === 3 && (
                    state.accFiles.length === 0 ? (
                        <UploadStep
                            type="ACCOUNTING"
                            files={state.accFiles}
                            onFilesChange={actions.setAccFiles}
                            onNext={() => { }}
                            onDemo={() => actions.handleDemoData('ACCOUNTING')}
                        />
                    ) : (
                        <MappingStep
                            file={state.accFiles[state.currentFileIndex]}
                            canonicalFields={mode === 'SALES' ? SALES_ACCOUNTING_VAT_FIELDS : PURCHASE_ACCOUNTING_VAT_FIELDS}
                            onComplete={(mapping, headerIndex) => actions.processAccFile(mapping, headerIndex, mode)}
                            onCancel={() => { actions.setAccFiles([]); actions.setStep(3); }}
                        />
                    )
                )}

                {/* Step 4: Accounting Matrah Upload & Mapping */}
                {state.step === 4 && mode === 'SALES' && (
                    state.accMatrahFiles.length === 0 ? (
                        <UploadStep
                            type="ACCOUNTING"
                            files={state.accMatrahFiles}
                            onFilesChange={actions.setAccMatrahFiles}
                            onNext={() => { }}
                            onDemo={() => actions.handleDemoData('ACCOUNTING_MATRAH')}
                        />
                    ) : (
                        <MappingStep
                            file={state.accMatrahFiles[state.currentFileIndex]}
                            canonicalFields={ACCOUNTING_MATRAH_FIELDS}
                            onComplete={actions.processAccMatrahFile}
                            onCancel={() => { actions.setAccMatrahFiles([]); actions.setStep(4); }}
                        />
                    )
                )}
            </div>
        </div>
    );
}
