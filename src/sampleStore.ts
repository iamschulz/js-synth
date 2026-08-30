import { createStore } from "./idb.ts";

export type StoredSample = {
	blob: Blob; // exactly what the MediaRecorder produced, mime type included
	frequency: number; // base pitch the sample plays back at unaltered
	note: string | null; // null when the pitch was only guessed
	trimOffset: number; // leading silence cut off after decoding, in samples
};

const store = createStore<StoredSample>("samples");

export const saveSample = (id: string, sample: StoredSample): Promise<void> => store.put(id, sample);

export const loadSample = (id: string): Promise<StoredSample | undefined> => store.get(id);

export const deleteSample = (id: string): Promise<void> => store.delete(id);
