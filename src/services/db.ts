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
const DB_VERSION = 2;

class DatabaseService {
    private dbPromise: Promise<IDBPDatabase<AppDB>>;

    constructor() {
        this.dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
            upgrade(db, _oldVersion, _newVersion, transaction) {
                let store;

                if (!db.objectStoreNames.contains('companies')) {
                    store = db.createObjectStore('companies', { keyPath: 'id' });
                } else {
                    store = transaction.objectStore('companies');
                }

                if (!store.indexNames.contains('by-date')) {
                    store.createIndex('by-date', 'updatedAt');
                }
            },
        });
    }

    async getAllCompanies(): Promise<Company[]> {
        const db = await this.dbPromise;
        try {
            const companies = await db.getAllFromIndex('companies', 'by-date');
            return companies.reverse(); // Newest first
        } catch {
            const companies = await db.getAll('companies');
            companies.sort((left, right) => {
                const leftTime = new Date(left.updatedAt || 0).getTime();
                const rightTime = new Date(right.updatedAt || 0).getTime();
                return rightTime - leftTime;
            });
            return companies;
        }
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
