// IndexedDB wrapper for Kanban board data
class KanbanDB {
    constructor() {
        this.dbName = 'KanbanDB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create columns store
                if (!db.objectStoreNames.contains('columns')) {
                    const columnStore = db.createObjectStore('columns', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    columnStore.createIndex('order', 'order', { unique: false });
                }

                // Create cards store
                if (!db.objectStoreNames.contains('cards')) {
                    const cardStore = db.createObjectStore('cards', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    cardStore.createIndex('columnId', 'columnId', { unique: false });
                    cardStore.createIndex('order', 'order', { unique: false });
                }
            };
        });
    }

    async addColumn(column) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['columns'], 'readwrite');
            const store = transaction.objectStore('columns');
            const request = store.add(column);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateColumn(column) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['columns'], 'readwrite');
            const store = transaction.objectStore('columns');
            const request = store.put(column);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteColumn(columnId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['columns'], 'readwrite');
            const store = transaction.objectStore('columns');
            const request = store.delete(columnId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAllColumns() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['columns'], 'readonly');
            const store = transaction.objectStore('columns');
            const request = store.getAll();

            request.onsuccess = () => {
                const columns = request.result;
                columns.sort((a, b) => a.order - b.order);
                resolve(columns);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async addCard(card) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readwrite');
            const store = transaction.objectStore('cards');
            const request = store.add(card);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateCard(card) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readwrite');
            const store = transaction.objectStore('cards');
            const request = store.put(card);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteCard(cardId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readwrite');
            const store = transaction.objectStore('cards');
            const request = store.delete(cardId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getCardsByColumn(columnId) {
        return new Promise((resolve, reject) => {
            if (columnId === undefined || columnId === null) {
                resolve([]);
                return;
            }
            
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const index = store.index('columnId');
            const request = index.getAll(columnId);

            request.onsuccess = () => {
                const cards = request.result;
                cards.sort((a, b) => a.order - b.order);
                resolve(cards);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteCardsByColumn(columnId) {
        return new Promise(async (resolve, reject) => {
            try {
                const cards = await this.getCardsByColumn(columnId);
                const transaction = this.db.transaction(['cards'], 'readwrite');
                const store = transaction.objectStore('cards');
                
                for (const card of cards) {
                    store.delete(card.id);
                }
                
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            } catch (error) {
                reject(error);
            }
        });
    }
}
