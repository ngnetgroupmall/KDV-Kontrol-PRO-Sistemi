import { useMemo, useState } from 'react';
import { AlertTriangle, Building2, Layers, Search, UserRound } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { useCompany } from '../../context/CompanyContext';
import type { AccountDetail, Company, MappingConfig } from '../common/types';
import { getMainAccountCode, resolveAccountBalanceRule, type ExpectedBalanceSide } from './accountingRules';
import { resolveForexAccountType } from './forexAccountRules';
import AccountStatementModal from './components/AccountStatementModal';
import VoucherDetailModal, { type VoucherDetailRow } from './components/VoucherDetailModal';

type MizanSource = 'FIRMA' | 'SMMM';
type ActualBalanceSide = 'BORC' | 'ALACAK' | 'KAPALI';
type AccountTypeMode = 'TL' | 'FOREX' | 'AUTO';

interface EvaluatedAccount {
    account: AccountDetail;
    mainCode: string;
    mainName: string;
    actualSide: ActualBalanceSide;
    expectedSide: ExpectedBalanceSide;
    section: string;
    isMismatch: boolean;
}

const EMPTY_ACCOUNTS: AccountDetail[] = [];
const EMPTY_FOREX_OVERRIDES: Record<string, boolean> = {};
const BALANCE_TOLERANCE = 0.01;

const normalizeVoucherNo = (value: string | undefined): string => {
    return String(value || '').trim().replace(/\s+/g, '').toLocaleUpperCase('tr-TR');
};

const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
};

const getActualBalanceSide = (balance: number): ActualBalanceSide => {
    if (Math.abs(balance) <= BALANCE_TOLERANCE) return 'KAPALI';
    return balance > 0 ? 'BORC' : 'ALACAK';
};

function MizanContent({ activeCompany }: { activeCompany: Company }) {
    const { patchActiveCompany } = useCompany();
    const [selectedSource, setSelectedSource] = useState<MizanSource>('FIRMA');
    const [search, setSearch] = useState('');
    const [showOnlyMismatched, setShowOnlyMismatched] = useState(false);
    const [selectedAccountCode, setSelectedAccountCode] = useState<string | null>(null);
    const [selectedVoucherNo, setSelectedVoucherNo] = useState<string | null>(null);

    const firmaData = activeCompany.currentAccount?.firmaFullData ?? EMPTY_ACCOUNTS;
    const smmmData = activeCompany.currentAccount?.smmmFullData ?? EMPTY_ACCOUNTS;
    const forexOverrides = activeCompany.currentAccount?.forexAccountOverrides ?? EMPTY_FOREX_OVERRIDES;

    const source = useMemo<MizanSource>(() => {
        if (selectedSource === 'FIRMA' && firmaData.length > 0) return 'FIRMA';
        if (selectedSource === 'SMMM' && smmmData.length > 0) return 'SMMM';
        if (firmaData.length > 0) return 'FIRMA';
        if (smmmData.length > 0) return 'SMMM';
        return selectedSource;
    }, [selectedSource, firmaData.length, smmmData.length]);

    const sourceData = useMemo(() => {
        return source === 'FIRMA' ? firmaData : smmmData;
    }, [source, firmaData, smmmData]);

    const mainNameByCode = useMemo(() => {
        const map = new Map<string, string>();

        sourceData.forEach((account) => {
            const mainCode = getMainAccountCode(account.code);
            const name = String(account.name || '').trim();
            if (!mainCode || !name) return;

            const current = map.get(mainCode);
            if (!current || name.length < current.length) {
                map.set(mainCode, name);
            }
        });

        return map;
    }, [sourceData]);

    const evaluatedAccounts = useMemo<EvaluatedAccount[]>(() => {
        return sourceData.map((account) => {
            const mainCode = getMainAccountCode(account.code);
            const rule = resolveAccountBalanceRule(account.code);
            const actualSide = getActualBalanceSide(account.balance);
            const expectedSide = rule?.expectedBalance || 'FARK_ETMEZ';
            const section = rule?.section || '-';
            const isMismatch = (
                expectedSide !== 'FARK_ETMEZ' &&
                actualSide !== 'KAPALI' &&
                actualSide !== expectedSide
            );

            return {
                account,
                mainCode,
                mainName: mainNameByCode.get(mainCode) || account.name || '-',
                actualSide,
                expectedSide,
                section,
                isMismatch,
            };
        });
    }, [sourceData, mainNameByCode]);

    const visibleAccounts = useMemo(() => {
        const query = search.trim().toLocaleLowerCase('tr-TR');

        return evaluatedAccounts.filter((row) => {
            if (showOnlyMismatched && !row.isMismatch) return false;

            if (!query) return true;
            return (
                row.account.code.toLocaleLowerCase('tr-TR').includes(query) ||
                row.account.name.toLocaleLowerCase('tr-TR').includes(query) ||
                row.mainCode.toLocaleLowerCase('tr-TR').includes(query) ||
                row.mainName.toLocaleLowerCase('tr-TR').includes(query) ||
                row.expectedSide.toLocaleLowerCase('tr-TR').includes(query) ||
                row.section.toLocaleLowerCase('tr-TR').includes(query)
            );
        });
    }, [evaluatedAccounts, search, showOnlyMismatched]);

    const mismatchCount = useMemo(() => {
        return evaluatedAccounts.filter((row) => row.isMismatch).length;
    }, [evaluatedAccounts]);

    const selectedAccount = useMemo(() => {
        if (!selectedAccountCode) return null;
        return sourceData.find((account) => account.code === selectedAccountCode) || null;
    }, [sourceData, selectedAccountCode]);

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

    const summary = useMemo(() => {
        return sourceData.reduce(
            (accumulator, account) => {
                accumulator.totalDebit += account.totalDebit;
                accumulator.totalCredit += account.totalCredit;
                accumulator.totalTransactions += account.transactionCount;
                return accumulator;
            },
            { totalDebit: 0, totalCredit: 0, totalTransactions: 0 }
        );
    }, [sourceData]);

    const hasAnyData = firmaData.length > 0 || smmmData.length > 0;

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Mizan Modulu</h1>
                <p className="text-slate-400 text-sm">
                    Ana hesap kurallarina gore beklenen bakiye yonu ve bilanco tarafi kontrol edilir.
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
                        Mizan verisi bulunamadi. Once Cari Hesap Kontrol modulunde dosyalari isleyin.
                    </div>
                )}

                {hasAnyData && sourceData.length === 0 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                        Secili kaynakta veri yok. Ustten diger kaynagi secin.
                    </div>
                )}
            </Card>

            {sourceData.length > 0 && (
                <Card className="space-y-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                            <div className="rounded-lg bg-slate-900/50 border border-slate-700 px-3 py-2">
                                <p className="text-slate-500">Hesap sayisi</p>
                                <p className="text-white font-semibold text-sm">{sourceData.length}</p>
                            </div>
                            <div className="rounded-lg bg-slate-900/50 border border-slate-700 px-3 py-2">
                                <p className="text-slate-500">Toplam borc</p>
                                <p className="text-emerald-300 font-semibold text-sm">{formatCurrency(summary.totalDebit)}</p>
                            </div>
                            <div className="rounded-lg bg-slate-900/50 border border-slate-700 px-3 py-2">
                                <p className="text-slate-500">Toplam alacak</p>
                                <p className="text-rose-300 font-semibold text-sm">{formatCurrency(summary.totalCredit)}</p>
                            </div>
                            <div className={`rounded-lg border px-3 py-2 ${mismatchCount > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-900/50 border-slate-700'}`}>
                                <p className="text-slate-500">Uyumsuz hesap</p>
                                <p className={`font-semibold text-sm ${mismatchCount > 0 ? 'text-red-300' : 'text-slate-300'}`}>{mismatchCount}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={() => setShowOnlyMismatched((value) => !value)}
                                className={`h-10 px-3 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors ${showOnlyMismatched
                                    ? 'bg-red-600/20 border-red-500/40 text-red-200'
                                    : 'bg-slate-900/50 border-slate-700 text-slate-300 hover:border-red-400/40'
                                    }`}
                            >
                                <span className="inline-flex items-center gap-1.5">
                                    <AlertTriangle size={14} />
                                    {showOnlyMismatched ? 'Tumunu Goster' : 'Sadece Uyumsuzlar'}
                                </span>
                            </button>

                            <div className="relative w-full sm:w-80">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Hesap kodu, adi, kural ara..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-auto rounded-xl border border-slate-700 bg-slate-900/40">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-800/80 sticky top-0 z-10">
                                <tr>
                                    <th className="p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">Hesap Kodu</th>
                                    <th className="p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">Hesap Adi</th>
                                    <th className="p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right">Borc</th>
                                    <th className="p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right">Alacak</th>
                                    <th className="p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right">Bakiye</th>
                                    <th className="p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 text-right">Hareket</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {visibleAccounts.map((row) => (
                                    <tr
                                        key={`${source}-${row.account.code}`}
                                        className={`${row.isMismatch ? 'bg-red-500/10 hover:bg-red-500/15' : 'hover:bg-slate-800/40'} transition-colors cursor-pointer`}
                                        onClick={() => setSelectedAccountCode(row.account.code)}
                                        title={`Hesap ekstresini ac | Beklenen: ${row.expectedSide} | Gerceklesen: ${row.actualSide} | Bilanco: ${row.section}`}
                                    >
                                        <td className="p-3 text-sm text-blue-300 font-mono">{row.account.code}</td>
                                        <td className="p-3 text-sm text-slate-200">{row.account.name || '-'}</td>
                                        <td className="p-3 text-sm text-slate-300 font-mono text-right">{formatCurrency(row.account.totalDebit)}</td>
                                        <td className="p-3 text-sm text-slate-300 font-mono text-right">{formatCurrency(row.account.totalCredit)}</td>
                                        <td className="p-3 text-sm font-mono text-right">
                                            <span className={row.account.balance >= 0 ? 'text-blue-300' : 'text-amber-300'}>
                                                {formatCurrency(Math.abs(row.account.balance))} {row.account.balance >= 0 ? '(B)' : '(A)'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-sm text-slate-400 text-right">{row.account.transactionCount}</td>
                                    </tr>
                                ))}
                                {visibleAccounts.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-10 text-center text-slate-500">
                                            Kriterlere uygun hesap bulunamadi.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {mismatchCount > 0 && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                            <span className="font-semibold">{mismatchCount}</span> hesap, beklenen bakiye yonu kuralina uymuyor. Bu satirlar tabloda kirmizi renkle gosterilir.
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

export default function MizanPage() {
    const { activeCompany } = useCompany();

    if (!activeCompany) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-fade-in">
                <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                    <Layers className="text-slate-600 w-12 h-12" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Firma secimi gerekli</h2>
                <p className="text-slate-400 max-w-md">
                    Mizan modulu icin lutfen once firma secin.
                </p>
            </div>
        );
    }

    return <MizanContent key={activeCompany.id} activeCompany={activeCompany} />;
}
