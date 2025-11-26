// IndexedDB wrapper for Kanban board data
class KanbanDB {
    constructor() {
        this.dbName = 'KanbanDB';
        this.version = 2;
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

                // Create lists store (new in v2)
                if (!db.objectStoreNames.contains('lists')) {
                    const listStore = db.createObjectStore('lists', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    listStore.createIndex('order', 'order', { unique: false });
                }

                // Create columns store
                if (!db.objectStoreNames.contains('columns')) {
                    const columnStore = db.createObjectStore('columns', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    columnStore.createIndex('order', 'order', { unique: false });
                    columnStore.createIndex('listId', 'listId', { unique: false });
                } else if (event.oldVersion < 2) {
                    // Add listId index to existing columns store
                    const columnStore = event.target.transaction.objectStore('columns');
                    if (!columnStore.indexNames.contains('listId')) {
                        columnStore.createIndex('listId', 'listId', { unique: false });
                    }
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

    // List methods
    async addList(list) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['lists'], 'readwrite');
            const store = transaction.objectStore('lists');
            const request = store.add(list);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateList(list) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['lists'], 'readwrite');
            const store = transaction.objectStore('lists');
            const request = store.put(list);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteList(listId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['lists'], 'readwrite');
            const store = transaction.objectStore('lists');
            const request = store.delete(listId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getList(listId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['lists'], 'readonly');
            const store = transaction.objectStore('lists');
            const request = store.get(listId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllLists() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['lists'], 'readonly');
            const store = transaction.objectStore('lists');
            const request = store.getAll();

            request.onsuccess = () => {
                const lists = request.result;
                lists.sort((a, b) => a.order - b.order);
                resolve(lists);
            };
            request.onerror = () => reject(request.error);
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

    async getColumnsByList(listId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['columns'], 'readonly');
            const store = transaction.objectStore('columns');
            const index = store.index('listId');
            const request = index.getAll(listId);

            request.onsuccess = () => {
                const columns = request.result;
                columns.sort((a, b) => a.order - b.order);
                resolve(columns);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteColumnsByList(listId) {
        return new Promise(async (resolve, reject) => {
            try {
                const columns = await this.getColumnsByList(listId);
                const transaction = this.db.transaction(['columns', 'cards'], 'readwrite');
                const columnStore = transaction.objectStore('columns');
                const cardStore = transaction.objectStore('cards');
                
                for (const column of columns) {
                    // Delete all cards in this column
                    const cardIndex = cardStore.index('columnId');
                    const cardRequest = cardIndex.getAll(column.id);
                    cardRequest.onsuccess = () => {
                        const cards = cardRequest.result;
                        for (const card of cards) {
                            cardStore.delete(card.id);
                        }
                    };
                    // Delete the column
                    columnStore.delete(column.id);
                }
                
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            } catch (error) {
                reject(error);
            }
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
