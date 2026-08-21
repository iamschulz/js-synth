import { StoredSample } from "./sampleStore.ts";
import { SynthSettings } from "./settingsStore.ts";
import { Waveform, waveforms } from "./waveform.ts";

const FORMAT = "js-synth-preset";
const VERSION = 1;
const CHUNK = 0x8000;

export type PresetSample = {
	data: string; // base64 blob
	frequency: number;
	note: string | null;
	trimOffset: number;
};

export type PresetSynth = {
	settings: { [k: string]: string };
	sample: PresetSample | null;
};

export type Preset = {
	format: typeof FORMAT;
	version: number;
	synths: PresetSynth[];
};

const toBase64 = (bytes: Uint8Array): string => {
	let binary = "";

	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}

	return btoa(binary);
};

const fromBase64 = (data: string): Uint8Array => {
	const binary = atob(data);
	const bytes = new Uint8Array(binary.length);

	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}

	return bytes;
};

const stripId = (key: string, id: string): string => (key.endsWith(`-${id}`) ? key.slice(0, -(id.length + 1)) : key);

export const sampleToPreset = async (sample: StoredSample): Promise<PresetSample> => ({
	data: toBase64(new Uint8Array(await sample.blob.arrayBuffer())),
	frequency: sample.frequency,
	note: sample.note,
	trimOffset: sample.trimOffset,
});

export const sampleFromPreset = (sample: PresetSample): StoredSample => ({
	blob: new Blob([fromBase64(sample.data)]),
	frequency: sample.frequency,
	note: sample.note,
	trimOffset: sample.trimOffset,
});

export const settingsToPreset = (settings: SynthSettings, id: string): { [k: string]: string } =>
	Object.fromEntries(
		Object.entries(settings)
			.filter(([, value]) => typeof value === "string")
			.map(([key, value]) => [stripId(key, id), value as string])
	);

/** Puts the control names of a preset back on the synth they are loaded into. */
export const settingsFromPreset = (settings: { [k: string]: string }, id: string): SynthSettings =>
	Object.fromEntries(Object.entries(settings).map(([key, value]) => [`${key}-${id}`, value]));

export const serializePreset = (synths: PresetSynth[]): string =>
	JSON.stringify({ format: FORMAT, version: VERSION, synths } satisfies Preset, null, "\t");

const isRecord = (value: unknown): value is { [k: string]: unknown } =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const fail: (message: string) => never = (message) => {
	throw new Error(message);
};

const validateSample = (value: unknown, at: string): PresetSample | null => {
	if (value === null || value === undefined) {
		return null; // synth without a recorded sample
	}

	if (!isRecord(value)) {
		fail(`${at} is neither a sample nor empty.`);
	}

	const sample = value;

	if (typeof sample.data !== "string") {
		fail(`${at} has no audio data.`);
	}

	const data = sample.data;

	try {
		atob(data);
	} catch (e) {
		fail(`${at} is not base64 encoded.`);
	}

	if (typeof sample.frequency !== "number" || !Number.isFinite(sample.frequency) || sample.frequency <= 0) {
		fail(`${at} has no playable base frequency.`);
	}

	if (sample.note != null && typeof sample.note !== "string") {
		fail(`${at} has an invalid note name.`);
	}

	const note = typeof sample.note === "string" ? sample.note : null;

	if (typeof sample.trimOffset !== "number" || !Number.isInteger(sample.trimOffset) || sample.trimOffset < 0) {
		fail(`${at} has an invalid trim offset.`);
	}

	return {
		data,
		frequency: sample.frequency,
		note,
		trimOffset: sample.trimOffset,
	};
};

const validateSettings = (value: unknown, at: string): { [k: string]: string } => {
	if (!isRecord(value)) {
		fail(`${at} has no settings.`);
	}

	const settings = value as { [k: string]: unknown };

	Object.entries(settings).forEach(([key, entry]) => {
		if (typeof entry !== "string") {
			fail(`${at}: the setting "${key}" is not a string.`);
		}
	});

	if (settings.waveform !== undefined && !waveforms.includes(settings.waveform as Waveform)) {
		fail(`${at} uses the unknown waveform "${settings.waveform}".`);
	}

	return settings as { [k: string]: string };
};

export const parsePreset = (text: string): PresetSynth[] => {
	let parsed: unknown;

	try {
		parsed = JSON.parse(text);
	} catch (e) {
		throw new Error("This file is not valid JSON.");
	}

	if (!isRecord(parsed)) {
		fail("This file does not contain a preset.");
	}

	const preset = parsed as { [k: string]: unknown };

	if (preset.format !== FORMAT) {
		fail("This file was not saved by JSSynth.");
	}

	if (typeof preset.version !== "number" || !Number.isInteger(preset.version) || preset.version < 1) {
		fail("This preset has no version.");
	}

	if (preset.version > VERSION) {
		fail(`This preset was saved by a newer version of JSSynth (${preset.version}).`);
	}

	if (!Array.isArray(preset.synths)) {
		fail("This preset holds no synths.");
	}

	const synths = preset.synths as unknown[];

	if (synths.length === 0) {
		fail("This preset holds no synths.");
	}

	return synths.map((synth, i) => {
		const at = `Synth ${i + 1}`;

		if (!isRecord(synth)) {
			fail(`${at} is not a synth.`);
		}

		const entry = synth as { [k: string]: unknown };

		return {
			settings: validateSettings(entry.settings, at),
			sample: validateSample(entry.sample, at),
		};
	});
};
