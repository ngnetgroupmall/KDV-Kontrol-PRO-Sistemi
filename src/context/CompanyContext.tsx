import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { dbService } from '../services/db';
import type { Company } from '../features/common/types';

export interface CompanyUploads {
    reconciliation: {
        eInvoiceFiles: File[];
        accountingFiles: File[];
        accountingMatrahFiles: File[];
    };
    currentAccount: {
        smmmFile: File | null;
        firmaFile: File | null;
    };
    kebirFile: File | null;
}

const EMPTY_UPLOADS: CompanyUploads = {
    reconciliation: {
        eInvoiceFiles: [],
        accountingFiles: [],
        accountingMatrahFiles: [],
    },
    currentAccount: {
        smmmFile: null,
        firmaFile: null,
    },
    kebirFile: null,
};

const createEmptyCompanyUploads = (): CompanyUploads => ({
    reconciliation: {
        eInvoiceFiles: [],
        accountingFiles: [],
        accountingMatrahFiles: [],
    },
    currentAccount: {
        smmmFile: null,
        firmaFile: null,
    },
    kebirFile: null,
});

interface CompanyContextType {
    companies: Company[];
    activeCompany: Company | null;
    activeUploads: CompanyUploads;
    isLoading: boolean;
    selectCompany: (id: string | null) => void;
    createCompany: (name: string, taxNumber?: string) => Promise<string>;
    updateCompany: (company: Company) => Promise<void>;
    patchActiveCompany: (updater: (current: Company) => Partial<Company>) => Promise<void>;
    setActiveUploads: (updater: (current: CompanyUploads) => CompanyUploads) => void;
    clearActiveUploads: () => void;
    deleteCompany: (id: string) => Promise<void>;
    refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const generateCompanyId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return uuidv4();
};

export function CompanyProvider({ children }: { children: ReactNode }) {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [uploadsByCompany, setUploadsByCompany] = useState<Record<string, CompanyUploads>>({});
    const [isLoading, setIsLoading] = useState(true);

    const activeUploads = useMemo<CompanyUploads>(() => {
        if (!activeCompany) return EMPTY_UPLOADS;
        return uploadsByCompany[activeCompany.id] || EMPTY_UPLOADS;
    }, [activeCompany?.id, uploadsByCompany]);

    useEffect(() => {
        loadCompanies();
    }, []);

    const loadCompanies = async () => {
        setIsLoading(true);
        try {
            const list = await dbService.getAllCompanies();
            setCompanies(list);

            // Restore active company from localStorage if exists
            const savedId = localStorage.getItem('activeCompanyId');
            if (savedId) {
                const found = list.find(c => c.id === savedId);
                if (found) setActiveCompany(found);
            }
        } catch (error) {
            console.error("Failed to load companies:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const selectCompany = (id: string | null) => {
        if (!id) {
            setActiveCompany(null);
            localStorage.removeItem('activeCompanyId');
            return;
        }
        const found = companies.find(c => c.id === id);
        if (found) {
            setActiveCompany(found);
            localStorage.setItem('activeCompanyId', id);
        }
    };

    const createCompany = async (name: string, taxNumber?: string) => {
        const normalizedName = name.trim();
        if (!normalizedName) {
            throw new Error('Firma adi bos olamaz.');
        }

        const newCompany: Company = {
            id: generateCompanyId(),
            name: normalizedName,
            taxNumber,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        try {
            await dbService.saveCompany(newCompany);
            const refreshed = await dbService.getAllCompanies();

            setCompanies(refreshed);
            const selected = refreshed.find((company) => company.id === newCompany.id) || newCompany;
            setActiveCompany(selected);
            localStorage.setItem('activeCompanyId', selected.id);

            return selected.id;
        } catch (error) {
            console.error('createCompany failed:', error);
            throw new Error('Firma kaydi veritabanina yazilamadi.');
        }
    };

    const updateCompany = async (company: Company) => {
        await dbService.saveCompany(company);

        // Optimistic update for UI speed
        setCompanies(prev => prev.map(c => c.id === company.id ? company : c));
        if (activeCompany?.id === company.id) {
            setActiveCompany(company);
        }
    };

    const patchActiveCompany = async (updater: (current: Company) => Partial<Company>) => {
        if (!activeCompany) return;

        const latest = await dbService.getCompany(activeCompany.id);
        if (!latest) return;

        const patch = updater(latest);
        const next: Company = { ...latest };
        const mutableNext = next as unknown as Record<string, unknown>;

        Object.entries(patch).forEach(([key, value]) => {
            if (value === undefined) {
                delete mutableNext[key];
                return;
            }
            mutableNext[key] = value;
        });

        await dbService.saveCompany(next);
        setCompanies(prev => prev.map(c => c.id === next.id ? next : c));
        setActiveCompany(next);
    };

    const setActiveUploads = (updater: (current: CompanyUploads) => CompanyUploads) => {
        if (!activeCompany) return;

        setUploadsByCompany((prev) => {
            const current = prev[activeCompany.id] || createEmptyCompanyUploads();
            return {
                ...prev,
                [activeCompany.id]: updater(current),
            };
        });
    };

    const clearActiveUploads = () => {
        if (!activeCompany) return;
        setUploadsByCompany((prev) => ({
            ...prev,
            [activeCompany.id]: createEmptyCompanyUploads(),
        }));
    };

    const deleteCompany = async (id: string) => {
        await dbService.deleteCompany(id);
        setUploadsByCompany((prev) => {
            if (!prev[id]) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
        });
        if (activeCompany?.id === id) {
            selectCompany(null);
        }
        await loadCompanies();
    };

    return (
        <CompanyContext.Provider value={{
            companies,
            activeCompany,
            activeUploads,
            isLoading,
            selectCompany,
            createCompany,
            updateCompany,
            patchActiveCompany,
            setActiveUploads,
            clearActiveUploads,
            deleteCompany,
            refreshCompanies: loadCompanies
        }}>
            {children}
        </CompanyContext.Provider>
    );
}

export function useCompany() {
    const context = useContext(CompanyContext);
    if (context === undefined) {
        throw new Error('useCompany must be used within a CompanyProvider');
    }
    return context;
}
