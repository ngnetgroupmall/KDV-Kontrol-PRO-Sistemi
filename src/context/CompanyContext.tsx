import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { dbService } from '../services/db';
import type { Company } from '../features/common/types';

interface CompanyContextType {
    companies: Company[];
    activeCompany: Company | null;
    isLoading: boolean;
    selectCompany: (id: string | null) => void;
    createCompany: (name: string, taxNumber?: string) => Promise<string>;
    updateCompany: (company: Company) => Promise<void>;
    deleteCompany: (id: string) => Promise<void>;
    refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [activeCompany, setActiveCompany] = useState<Company | null>(null);
    const [isLoading, setIsLoading] = useState(true);

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
        const newCompany: Company = {
            id: uuidv4(),
            name,
            taxNumber,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await dbService.saveCompany(newCompany);
        await loadCompanies();
        selectCompany(newCompany.id);
        return newCompany.id;
    };

    const updateCompany = async (company: Company) => {
        await dbService.saveCompany(company);

        // Optimistic update for UI speed
        setCompanies(prev => prev.map(c => c.id === company.id ? company : c));
        if (activeCompany?.id === company.id) {
            setActiveCompany(company);
        }
    };

    const deleteCompany = async (id: string) => {
        await dbService.deleteCompany(id);
        if (activeCompany?.id === id) {
            selectCompany(null);
        }
        await loadCompanies();
    };

    return (
        <CompanyContext.Provider value={{
            companies,
            activeCompany,
            isLoading,
            selectCompany,
            createCompany,
            updateCompany,
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
