const DB_NAME = "js-synth";
const DB_VERSION = 1;
const STORE = "samples";

export type StoredSample = {
	blob: Blob; // exactly what the MediaRecorder produced, mime type included
	frequency: number; // base pitch the sample plays back at unaltered
	note: string | null; // null when the pitch was only guessed
	trimOffset: number; // leading silence cut off after decoding, in samples
};

let connection: Promise<IDBDatabase> | null = null;
let persistenceRequested = false;

const open = (): Promise<IDBDatabase> => {
	if (!connection) {
		connection = new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);
			request.addEventListener("upgradeneeded", () => {
				if (!request.result.objectStoreNames.contains(STORE)) {
					request.result.createObjectStore(STORE);
				}
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

const transact = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
	const db = await open();

	return new Promise<T>((resolve, reject) => {
		const tx = db.transaction(STORE, mode);
		const request = run(tx.objectStore(STORE));
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

export const saveSample = (id: string, sample: StoredSample): Promise<IDBValidKey> => {
	requestPersistence();
	return transact("readwrite", (store) => store.put(sample, id));
};

export const loadSample = (id: string): Promise<StoredSample | undefined> =>
	transact("readonly", (store) => store.get(id));

export const deleteSample = (id: string): Promise<undefined> =>
	transact("readwrite", (store) => store.delete(id));
