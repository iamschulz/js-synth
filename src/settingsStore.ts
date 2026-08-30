import { createStore } from "./idb.ts";

/* one record per synth, keyed by the id of its controls form */
const SYNTH_PREFIX = "synth-controls-";

/* scroll offset of the synth slider, shared by all synths */
const SLIDER_POSITION = "slider-position";

export type SynthSettings = { [k: string]: FormDataEntryValue };

type Setting = SynthSettings | number;

const store = createStore<Setting>("settings");

const synthId = (key: string): number => parseInt(key.slice(SYNTH_PREFIX.length));

// idb key
export const synthSettingsName = (id: string): string => `${SYNTH_PREFIX}${id}`;

export const loadSynthSettings = async (name: string): Promise<SynthSettings | undefined> =>
	(await store.get(name)) as SynthSettings | undefined;

export const saveSynthSettings = (name: string, settings: SynthSettings): Promise<void> => store.put(name, settings);

export const deleteSynthSettings = (name: string): Promise<void> => store.delete(name);

/* names of the stored synths, oldest first */
export const listSynthSettings = async (): Promise<string[]> =>
	(await store.keys()).filter((key) => key.startsWith(SYNTH_PREFIX)).sort((a, b) => synthId(a) - synthId(b));

export const loadSliderPosition = async (): Promise<number> => ((await store.get(SLIDER_POSITION)) as number) || 0;

export const saveSliderPosition = (position: number): Promise<void> => store.put(SLIDER_POSITION, position);
