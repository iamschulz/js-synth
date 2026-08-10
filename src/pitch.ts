const MIN_FREQ = 50;
const MAX_FREQ = 2000;
const WINDOW_SIZE = 2048;
const MAX_WINDOWS = 24;
const RMS_GATE = 0.01;
const CONFIDENCE = 0.5;

const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const frequencyToNoteName = (frequency: number): string => {
	const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
	const name = noteNames[((midi % 12) + 12) % 12];
	return `${name}${Math.floor(midi / 12) - 1}`;
};

const detectWindowFrequency = (samples: Float32Array, sampleRate: number): number | null => {
	const size = samples.length;

	/* prefix sums of squares, so the correlation of every lag can be normalized cheaply */
	const energies = new Float64Array(size + 1);
	for (let i = 0; i < size; i++) {
		energies[i + 1] = energies[i] + samples[i] * samples[i];
	}

	const rms = Math.sqrt(energies[size] / size);
	if (rms < RMS_GATE) {
		return null; // silence
	}

	const minLag = Math.max(2, Math.floor(sampleRate / MAX_FREQ));
	const maxLag = Math.min(size - 2, Math.floor(sampleRate / MIN_FREQ));
	if (maxLag <= minLag) {
		return null;
	}

	const correlations = new Float64Array(maxLag + 2);
	for (let lag = minLag; lag <= maxLag; lag++) {
		let sum = 0;
		const overlap = size - lag;
		for (let i = 0; i < overlap; i++) {
			sum += samples[i] * samples[i + lag];
		}

		const head = energies[overlap];
		const tail = energies[size] - energies[lag];
		correlations[lag] = sum / (Math.sqrt(head * tail) || Infinity);
	}

	let best = minLag;
	let bestVal = -Infinity;
	for (let lag = minLag; lag <= maxLag; lag++) {
		if (correlations[lag] > bestVal) {
			bestVal = correlations[lag];
			best = lag;
		}
	}

	if (bestVal < CONFIDENCE) {
		return null; // no periodicity worth reporting
	}

	for (let lag = minLag + 1; lag < best; lag++) {
		const isPeak = correlations[lag] > correlations[lag - 1] && correlations[lag] >= correlations[lag + 1];
		if (isPeak && correlations[lag] >= bestVal * 0.9) {
			best = lag;
			bestVal = correlations[lag];
			break;
		}
	}

	/* parabolic interpolation for sub-sample accuracy */
	let lag = best;
	if (best > minLag && best < maxLag) {
		const a = correlations[best - 1];
		const b = correlations[best];
		const c = correlations[best + 1];
		const denominator = 2 * (a - 2 * b + c);
		if (denominator !== 0) {
			lag = best + (a - c) / denominator;
		}
	}

	const frequency = sampleRate / lag;
	return frequency >= MIN_FREQ && frequency <= MAX_FREQ ? frequency : null;
};

export const detectFrequency = (buffer: AudioBuffer): number | null => {
	const data = buffer.getChannelData(0);
	const size = Math.min(WINDOW_SIZE, data.length);

	if (size < 256) {
		return null; // too short to analyze
	}

	const windowCount = Math.max(1, Math.min(MAX_WINDOWS, Math.floor(data.length / size)));
	const step = windowCount > 1 ? Math.floor((data.length - size) / (windowCount - 1)) : 0;

	const estimates: number[] = [];
	for (let w = 0; w < windowCount; w++) {
		const offset = Math.min(w * step, data.length - size);
		const frequency = detectWindowFrequency(data.subarray(offset, offset + size), buffer.sampleRate);
		if (frequency) {
			estimates.push(frequency);
		}
	}

	if (estimates.length === 0) {
		return null;
	}

	estimates.sort((a, b) => a - b);
	const mid = Math.floor(estimates.length / 2);

	return estimates.length % 2 === 1 ? estimates[mid] : (estimates[mid - 1] + estimates[mid]) / 2;
};
