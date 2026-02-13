import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Company } from '../features/common/types';

interface AppDB extends DBSchema {
    companies: {
        key: string;
        value: Company;
        indexes: { 'by-date': Date };
    };
}

const DB_NAME = 'kdv-kontrol-app-db';
const DB_VERSION = 1;

class DatabaseService {
    private dbPromise: Promise<IDBPDatabase<AppDB>>;

    constructor() {
        this.dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                const store = db.createObjectStore('companies', { keyPath: 'id' });
                store.createIndex('by-date', 'updatedAt');
            },
        });
    }

    async getAllCompanies(): Promise<Company[]> {
        const db = await this.dbPromise;
        const companies = await db.getAllFromIndex('companies', 'by-date');
        return companies.reverse(); // Newest first
    }

    async getCompany(id: string): Promise<Company | undefined> {
        const db = await this.dbPromise;
        return await db.get('companies', id);
    }

    async saveCompany(company: Company): Promise<void> {
        const db = await this.dbPromise;
        company.updatedAt = new Date(); // Always update timestamp
        await db.put('companies', company);
    }

    async deleteCompany(id: string): Promise<void> {
        const db = await this.dbPromise;
        await db.delete('companies', id);
    }
}

export const dbService = new DatabaseService();
