import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { AccountDetail } from '../../common/types';

export interface MappingConfig {
    smmm: Record<string, string>;
    firma: Record<string, string>;
}

export interface Workspace {
    id: string;
    companyName: string;
    lastUpdated: Date;
    smmmData: AccountDetail[];
    firmaData: AccountDetail[];
    mappings: MappingConfig;
}

interface CurrentAccountDB extends DBSchema {
    workspaces: {
        key: string;
        value: Workspace;
        indexes: { 'by-date': Date };
    };
}

const DB_NAME = 'kdv-kontrol-current-account-db';
const DB_VERSION = 1;

export class StorageService {
    private dbPromise: Promise<IDBPDatabase<CurrentAccountDB>>;

    constructor() {
        this.dbPromise = openDB<CurrentAccountDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                const store = db.createObjectStore('workspaces', { keyPath: 'id' });
                store.createIndex('by-date', 'lastUpdated');
            },
        });
    }

    async getAllWorkspaces(): Promise<Workspace[]> {
        const db = await this.dbPromise;
        return await db.getAllFromIndex('workspaces', 'by-date');
    }

    async getWorkspace(id: string): Promise<Workspace | undefined> {
        const db = await this.dbPromise;
        return await db.get('workspaces', id);
    }

    async saveWorkspace(workspace: Workspace): Promise<string> {
        const db = await this.dbPromise;
        await db.put('workspaces', workspace);
        return workspace.id;
    }

    async deleteWorkspace(id: string): Promise<void> {
        const db = await this.dbPromise;
        await db.delete('workspaces', id);
    }
}

export const storageService = new StorageService();
