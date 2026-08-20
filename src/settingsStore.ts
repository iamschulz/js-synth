import { createStore } from "./idb.ts";

/* one record per synth, keyed by the id of its controls form */
const SYNTH_PREFIX = "synth-controls-";

/* scroll offset of the synth slider, shared by all synths */
const SLIDER_POSITION = "slider-position";

export type SynthSettings = { [k: string]: FormDataEntryValue };

type Setting = SynthSettings | number;

const store = createStore<Setting>("settings");

const synthId = (key: string): number => parseInt(key.slice(SYNTH_PREFIX.length));

/* touching localStorage can throw outright, and adopting it is optional anyway */
const legacy = (): Storage | null => {
	try {
		return localStorage;
	} catch (e) {
		return null;
	}
};

/**
 * Adopts what an earlier version left in localStorage. Every setting is keyed
 * the same way it was back then, so it can be picked up on its first read.
 */
const migrate = async (key: string): Promise<Setting | undefined> => {
	const stored = legacy()?.getItem(key) ?? null;

	if (stored === null) {
		return undefined;
	}

	let value: Setting;

	try {
		value = key === SLIDER_POSITION ? parseInt(stored) || 0 : (JSON.parse(stored) as SynthSettings);
	} catch (e) {
		console.error(`Could not read the legacy setting "${key}".`, e);
		legacy()?.removeItem(key); // unparseable, a later attempt would not fare better
		return undefined;
	}

	await store.put(key, value); // rejects to the caller, leaving the key for a retry
	legacy()?.removeItem(key);

	return value;
};

const read = async (key: string): Promise<Setting | undefined> => {
	const stored = await store.get(key);

	if (stored === undefined) {
		return migrate(key);
	}

	legacy()?.removeItem(key); // an older copy of an already stored setting
	return stored;
};

export const loadSynthSettings = async (name: string): Promise<SynthSettings | undefined> =>
	(await read(name)) as SynthSettings | undefined;

export const saveSynthSettings = (name: string, settings: SynthSettings): Promise<void> => store.put(name, settings);

export const deleteSynthSettings = (name: string): Promise<void> => {
	legacy()?.removeItem(name);
	return store.delete(name);
};

/* names of the stored synths, oldest first, including ones yet to be migrated */
export const listSynthSettings = async (): Promise<string[]> => {
	const keys = [...(await store.keys()), ...Object.keys(legacy() ?? {})];

	return [...new Set(keys)].filter((key) => key.startsWith(SYNTH_PREFIX)).sort((a, b) => synthId(a) - synthId(b));
};

export const loadSliderPosition = async (): Promise<number> => ((await read(SLIDER_POSITION)) as number) || 0;

export const saveSliderPosition = (position: number): Promise<void> => store.put(SLIDER_POSITION, position);
