const DB_NAME = "js-synth";
const DB_VERSION = 2;

/* every store the app keeps, created on demand when the database is upgraded */
const STORES = ["samples", "settings"];

export type Store<T> = {
	get: (key: string) => Promise<T | undefined>;
	keys: () => Promise<string[]>;
	put: (key: string, value: T) => Promise<void>;
	delete: (key: string) => Promise<void>;
};

let connection: Promise<IDBDatabase> | null = null;
let persistenceRequested = false;

const open = (): Promise<IDBDatabase> => {
	if (!connection) {
		connection = new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);
			request.addEventListener("upgradeneeded", () => {
				STORES.filter((store) => !request.result.objectStoreNames.contains(store)).forEach((store) =>
					request.result.createObjectStore(store)
				);
			});
			request.addEventListener("success", () => resolve(request.result));
			request.addEventListener("error", () => reject(request.error));
		});

		connection.catch(() => {
			connection = null; // reset for later attempts
		});
	}

	return connection;
};

const transact = async <T>(
	store: string,
	mode: IDBTransactionMode,
	run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
	const db = await open();

	return new Promise<T>((resolve, reject) => {
		const tx = db.transaction(store, mode);
		const request = run(tx.objectStore(store));
		request.addEventListener("success", () => resolve(request.result));
		tx.addEventListener("error", () => reject(tx.error));
		tx.addEventListener("abort", () => reject(tx.error));
	});
};

// FF needs to ask for for permission for larger samples
const requestPersistence = (): void => {
	if (persistenceRequested) {
		return;
	}

	persistenceRequested = true;
	navigator.storage?.persist?.().catch(() => {});
};

/**
 * A typed key-value handle on one object store. Several handles can share a
 * store when its records differ in shape, they all talk to the same connection.
 */
export const createStore = <T>(name: string): Store<T> => ({
	get: (key) => transact<T | undefined>(name, "readonly", (store) => store.get(key)),
	keys: async () => (await transact<IDBValidKey[]>(name, "readonly", (store) => store.getAllKeys())).map(String),
	put: async (key, value) => {
		requestPersistence();
		await transact(name, "readwrite", (store) => store.put(value, key));
	},
	delete: (key) => transact(name, "readwrite", (store) => store.delete(key)),
});
