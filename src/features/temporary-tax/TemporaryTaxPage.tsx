import { useMemo, useState } from 'react';
import { AlertTriangle, Building2, Layers, UserRound } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { useCompany } from '../../context/CompanyContext';
import type { AccountDetail, Company, MappingConfig } from '../common/types';
import { resolveForexAccountType } from '../mizan/forexAccountRules';
import AccountStatementModal, { type AccountStatementRowIssue } from '../mizan/components/AccountStatementModal';
import VoucherDetailModal, { type VoucherDetailRow } from '../mizan/components/VoucherDetailModal';
import { buildTemporaryTaxControls, type TemporaryTaxControlResult } from './controlChecks';

type TemporaryTaxSource = 'FIRMA' | 'SMMM';
type AccountTypeMode = 'TL' | 'FOREX' | 'AUTO';

const EMPTY_ACCOUNTS: AccountDetail[] = [];
const EMPTY_FOREX_OVERRIDES: Record<string, boolean> = {};

const normalizeVoucherNo = (value: string | undefined): string => {
    return String(value || '').trim().replace(/\s+/g, '').toLocaleUpperCase('tr-TR');
};

const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
};

function TemporaryTaxContent({ activeCompany }: { activeCompany: Company }) {
    const { patchActiveCompany } = useCompany();
    const [selectedSource, setSelectedSource] = useState<TemporaryTaxSource>('FIRMA');
    const [selectedControlId, setSelectedControlId] = useState<string>('reverse-balance');
    const [selectedAccountCode, setSelectedAccountCode] = useState<string | null>(null);
    const [selectedVoucherNo, setSelectedVoucherNo] = useState<string | null>(null);

    const firmaData = activeCompany.currentAccount?.firmaFullData ?? EMPTY_ACCOUNTS;
    const smmmData = activeCompany.currentAccount?.smmmFullData ?? EMPTY_ACCOUNTS;
    const forexOverrides = activeCompany.currentAccount?.forexAccountOverrides ?? EMPTY_FOREX_OVERRIDES;

    const source = useMemo<TemporaryTaxSource>(() => {
        if (selectedSource === 'FIRMA' && firmaData.length > 0) return 'FIRMA';
        if (selectedSource === 'SMMM' && smmmData.length > 0) return 'SMMM';
        if (firmaData.length > 0) return 'FIRMA';
        if (smmmData.length > 0) return 'SMMM';
        return selectedSource;
    }, [selectedSource, firmaData.length, smmmData.length]);

    const sourceData = useMemo(() => {
        return source === 'FIRMA' ? firmaData : smmmData;
    }, [source, firmaData, smmmData]);

    const controls = useMemo<TemporaryTaxControlResult[]>(() => {
        return buildTemporaryTaxControls(sourceData, forexOverrides);
    }, [sourceData, forexOverrides]);

    const selectedControl = useMemo(() => {
        if (!controls.length) return null;
        return controls.find((control) => control.id === selectedControlId) || controls[0];
    }, [controls, selectedControlId]);

    const selectedAccount = useMemo(() => {
        if (!selectedAccountCode) return null;
        return sourceData.find((account) => account.code === selectedAccountCode) || null;
    }, [sourceData, selectedAccountCode]);

    const selectedControlAccountItem = useMemo(() => {
        if (!selectedControl || !selectedAccountCode) return null;
        return selectedControl.accounts.find((item) => item.account.code === selectedAccountCode) || null;
    }, [selectedControl, selectedAccountCode]);

    const selectedAccountRowIssues = useMemo<Record<number, AccountStatementRowIssue>>(() => {
        const map: Record<number, AccountStatementRowIssue> = {};
        if (!selectedControlAccountItem?.rowIssues) return map;
        selectedControlAccountItem.rowIssues.forEach((issue) => {
            if (!map[issue.rowIndex]) {
                map[issue.rowIndex] = {
                    code: issue.code,
                    message: issue.message,
                };
                return;
            }

            const mergedCodes = new Set(
                `${map[issue.rowIndex].code},${issue.code}`
                    .split(',')
                    .map((part) => part.trim())
                    .filter(Boolean)
            );
            map[issue.rowIndex] = {
                code: Array.from(mergedCodes).join(', '),
                message: `${map[issue.rowIndex].message} | ${issue.message}`,
            };
        });
        return map;
    }, [selectedControlAccountItem]);

    const selectedAccountForexType = useMemo(() => {
        if (!selectedAccount) return null;
        return resolveForexAccountType(selectedAccount.code, selectedAccount.name || '', forexOverrides);
    }, [selectedAccount, forexOverrides]);

    const handleAccountTypeChange = async (mode: AccountTypeMode) => {
        if (!selectedAccount) return;

        await patchActiveCompany((company) => {
            const currentAccount = company.currentAccount || {
                smmmData: [] as AccountDetail[],
                firmaData: [] as AccountDetail[],
                mappings: {} as MappingConfig,
            };

            const nextOverrides = {
                ...(currentAccount.forexAccountOverrides || {}),
            };

            if (mode === 'AUTO') {
                delete nextOverrides[selectedAccount.code];
            } else {
                nextOverrides[selectedAccount.code] = mode === 'FOREX';
            }

            return {
                currentAccount: {
                    ...currentAccount,
                    forexAccountOverrides: nextOverrides,
                },
            };
        });
    };

    const voucherRows = useMemo<VoucherDetailRow[]>(() => {
        if (!selectedVoucherNo) return [];
        const target = normalizeVoucherNo(selectedVoucherNo);
        if (!target) return [];

        const rows: VoucherDetailRow[] = [];
        sourceData.forEach((account) => {
            account.transactions.forEach((transaction) => {
                if (normalizeVoucherNo(transaction.voucherNo) !== target) return;
                rows.push({
                    accountCode: account.code,
                    accountName: account.name,
                    documentNo: transaction.documentNo || transaction.voucherNo,
                    date: transaction.date,
                    description: transaction.description,
                    debit: transaction.debit,
                    credit: transaction.credit,
                    currencyCode: transaction.currencyCode,
                    exchangeRate: transaction.exchangeRate,
                    fxDebit: transaction.fxDebit,
                    fxCredit: transaction.fxCredit,
                    fxBalance: transaction.fxBalance,
                });
            });
        });

        rows.sort((a, b) => {
            const aTime = a.date ? a.date.getTime() : Number.MAX_SAFE_INTEGER;
            const bTime = b.date ? b.date.getTime() : Number.MAX_SAFE_INTEGER;
            return aTime - bTime;
        });

        return rows;
    }, [selectedVoucherNo, sourceData]);

    const hasAnyData = firmaData.length > 0 || smmmData.length > 0;

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Gecici Vergi Modulu</h1>
                <p className="text-slate-400 text-sm">
                    Kontrol kartlarini tiklayarak riskli hesaplari listeleyin. Her kart yeni kontrol eklenebilir yapidadir.
                </p>
                <p className="text-xs text-blue-300 mt-1">{activeCompany.name}</p>
            </div>

            <Card className="space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Veri Kaynagi Secimi</h2>
                        <p className="text-xs text-slate-400 mt-1">
                            Firma secildiginde Firma Kebir dosyasi, SMMM secildiginde SMMM Kebir dosyasi kullanilir.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setSelectedSource('FIRMA')}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${source === 'FIRMA'
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'bg-slate-900/50 border-slate-700 text-slate-300 hover:border-indigo-400/50'
                                }`}
                        >
                            <span className="inline-flex items-center gap-2">
                                <Building2 size={14} /> Firma ({firmaData.length})
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedSource('SMMM')}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${source === 'SMMM'
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-slate-900/50 border-slate-700 text-slate-300 hover:border-blue-400/50'
                                }`}
                        >
                            <span className="inline-flex items-center gap-2">
                                <UserRound size={14} /> SMMM ({smmmData.length})
                            </span>
                        </button>
                    </div>
                </div>

                {!hasAnyData && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                        Gecici vergi kontrolu icin veri bulunamadi. Once Cari Hesap Kontrol modulunde dosyalari isleyin.
                    </div>
                )}

                {hasAnyData && sourceData.length === 0 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                        Secili kaynakta veri yok. Ustten diger kaynagi secin.
                    </div>
                )}
            </Card>

            {sourceData.length > 0 && (
                <Card className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {controls.map((control) => {
                            const isActive = selectedControl?.id === control.id;
                            return (
                                <button
                                    key={control.id}
                                    type="button"
                                    onClick={() => setSelectedControlId(control.id)}
                                    className={`text-left rounded-xl border p-4 transition-colors ${isActive
                                        ? 'border-blue-500/50 bg-blue-500/10'
                                        : 'border-slate-700 bg-slate-900/40 hover:border-blue-500/30'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-bold text-white">{control.title}</h3>
                                            <p className="text-xs text-slate-400 mt-1">{control.description}</p>
                                        </div>
                                        <span className={`text-lg font-bold ${control.accounts.length > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                                            {control.accounts.length}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {selectedControl && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div>
                                    <h4 className="text-base font-semibold text-white">{selectedControl.title}</h4>
                                    <p className="text-xs text-slate-400">{selectedControl.description}</p>
                                </div>
                                <div className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${selectedControl.accounts.length > 0 ? 'bg-red-500/15 text-red-200 border border-red-500/30' : 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30'}`}>
                                    <AlertTriangle size={14} />
                                    {selectedControl.accounts.length} hesap
                                </div>
                            </div>

                            {selectedControl.accounts.length === 0 ? (
                                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                                    Bu kontrol icin problemli hesap bulunmadi.
                                </div>
                            ) : (
                                <div className="overflow-auto rounded-xl border border-slate-700 bg-slate-900/40">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-800/80 sticky top-0 z-10">
                                            <tr>
                                                <th className="p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">Hesap Kodu</th>
                                                <th className="p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">Hesap Adi</th>
                                                <th className="p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">Kontrol Sonucu</th>
                                                <th className="p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">Detay</th>
                                                <th className="p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right">Bakiye</th>
                                                <th className="p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right">Hareket</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {selectedControl.accounts.map((item) => (
                                                <tr
                                                    key={`${selectedControl.id}-${item.account.code}`}
                                                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                                                    onClick={() => setSelectedAccountCode(item.account.code)}
                                                    title="Hesap ekstresini ac"
                                                >
                                                    <td className="p-3 text-sm text-blue-300 font-mono">{item.account.code}</td>
                                                    <td className="p-3 text-sm text-slate-200">{item.account.name || '-'}</td>
                                                    <td className="p-3 text-sm text-red-200">{item.reason}</td>
                                                    <td className="p-3 text-sm text-slate-400">{item.detail || '-'}</td>
                                                    <td className="p-3 text-sm text-slate-300 font-mono text-right">{formatCurrency(item.account.balance)}</td>
                                                    <td className="p-3 text-sm text-slate-400 text-right">{item.account.transactionCount}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            )}

            <AccountStatementModal
                account={selectedAccount}
                isForexAccount={selectedAccountForexType?.isForex || false}
                inferredCurrency={selectedAccountForexType?.inferredCurrency}
                accountTypeSource={selectedAccountForexType?.source}
                inferenceReason={selectedAccountForexType?.reason}
                rowIssueByIndex={selectedAccountRowIssues}
                onAccountTypeChange={handleAccountTypeChange}
                onClose={() => setSelectedAccountCode(null)}
                onVoucherClick={(voucherNo) => setSelectedVoucherNo(voucherNo)}
            />

            <VoucherDetailModal
                voucherNo={selectedVoucherNo}
                rows={voucherRows}
                onClose={() => setSelectedVoucherNo(null)}
            />
        </div>
    );
}

export default function TemporaryTaxPage() {
    const { activeCompany } = useCompany();

    if (!activeCompany) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-fade-in">
                <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                    <Layers className="text-slate-600 w-12 h-12" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Firma secimi gerekli</h2>
                <p className="text-slate-400 max-w-md">
                    Gecici vergi modulu icin lutfen once firma secin.
                </p>
            </div>
        );
    }

    return <TemporaryTaxContent key={activeCompany.id} activeCompany={activeCompany} />;
}
