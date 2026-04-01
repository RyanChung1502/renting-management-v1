// ===== IndexedDB Database Layer =====
const DB_NAME = 'RentMgrDB';
const DB_VERSION = 3;

class Database {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Rooms store
                if (!db.objectStoreNames.contains('rooms')) {
                    const roomStore = db.createObjectStore('rooms', { keyPath: 'id' });
                    roomStore.createIndex('name', 'name', { unique: false });
                    roomStore.createIndex('status', 'status', { unique: false });
                }

                // Settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                // Tenants store
                if (!db.objectStoreNames.contains('tenants')) {
                    const tenantStore = db.createObjectStore('tenants', { keyPath: 'id' });
                    tenantStore.createIndex('name', 'name', { unique: false });
                    tenantStore.createIndex('roomId', 'roomId', { unique: false });
                    tenantStore.createIndex('phone', 'phone', { unique: false });
                }

                // Electric meters store (v3)
                if (!db.objectStoreNames.contains('electricMeters')) {
                    const meterStore = db.createObjectStore('electricMeters', { keyPath: 'id' });
                    meterStore.createIndex('roomId', 'roomId', { unique: false });
                    meterStore.createIndex('month', 'month', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    // ===== Generic CRUD =====

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getById(storeName, id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ===== Room Operations =====

    async getAllRooms() {
        return this.getAll('rooms');
    }

    async getRoom(id) {
        return this.getById('rooms', id);
    }

    async saveRoom(room) {
        if (!room.id) {
            room.id = 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            room.createdAt = new Date().toISOString();
        }
        room.updatedAt = new Date().toISOString();
        return this.put('rooms', room);
    }

    async deleteRoom(id) {
        // Also delete associated tenants
        const tenants = await this.getTenantsByRoom(id);
        for (const tenant of tenants) {
            await this.delete('tenants', tenant.id);
        }
        return this.delete('rooms', id);
    }

    // ===== Tenant Operations =====

    async getAllTenants() {
        return this.getAll('tenants');
    }

    async getTenant(id) {
        return this.getById('tenants', id);
    }

    async getTenantsByRoom(roomId) {
        return this.getByIndex('tenants', 'roomId', roomId);
    }

    async saveTenant(tenant) {
        if (!tenant.id) {
            tenant.id = 'tenant_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            tenant.createdAt = new Date().toISOString();
        }
        tenant.updatedAt = new Date().toISOString();
        return this.put('tenants', tenant);
    }

    async deleteTenant(id) {
        return this.delete('tenants', id);
    }

    // ===== Electric Meter Operations =====

    async getAllMeters() {
        return this.getAll('electricMeters');
    }

    async getMetersByRoom(roomId) {
        return this.getByIndex('electricMeters', 'roomId', roomId);
    }

    async saveMeter(meter) {
        if (!meter.id) {
            meter.id = 'meter_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            meter.createdAt = new Date().toISOString();
        }
        meter.updatedAt = new Date().toISOString();
        return this.put('electricMeters', meter);
    }

    async deleteMeter(id) {
        return this.delete('electricMeters', id);
    }

    // ===== Settings Operations =====

    async getSetting(key) {
        const result = await this.getById('settings', key);
        return result ? result.value : null;
    }

    async saveSetting(key, value) {
        return this.put('settings', { key, value });
    }

    async getAllSettings() {
        return this.getAll('settings');
    }

    // ===== Backup / Restore =====

    async exportAll() {
        const rooms = await this.getAllRooms();
        const tenants = await this.getAllTenants();
        const settings = await this.getAllSettings();
        const electricMeters = await this.getAllMeters();
        return {
            version: DB_VERSION,
            exportedAt: new Date().toISOString(),
            data: { rooms, tenants, settings, electricMeters }
        };
    }

    async importAll(backup) {
        const { rooms, tenants, settings, electricMeters } = backup.data;

        // Clear existing data
        const stores = ['rooms', 'tenants', 'settings', 'electricMeters'];
        for (const name of stores) {
            if (this.db.objectStoreNames.contains(name)) {
                const tx = this.db.transaction(name, 'readwrite');
                tx.objectStore(name).clear();
                await new Promise((resolve) => { tx.oncomplete = resolve; });
            }
        }

        // Import new data
        for (const room of (rooms || [])) {
            await this.put('rooms', room);
        }
        for (const tenant of (tenants || [])) {
            await this.put('tenants', tenant);
        }
        for (const setting of (settings || [])) {
            await this.put('settings', setting);
        }
        for (const meter of (electricMeters || [])) {
            await this.put('electricMeters', meter);
        }
    }
}

const db = new Database();
export default db;
