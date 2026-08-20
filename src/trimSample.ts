const WINDOW = 256; // Windows of roughly 5ms, enough to tell a transient from the noise floor
const RELATIVE_THRESHOLD = 0.05; // The signal starts where a window rises this far towards the loudest one
const NOISE_FLOOR = 0.003; // Nothing below this counts as signal
const PREROLL = 0.01; // Kept in front of the transient in seconds, so the attack survives the cut

export const findSampleStart = (buffer: AudioBuffer): number => {
	const data = buffer.getChannelData(0);
	const windows = Math.floor(data.length / WINDOW);

	if (windows < 2) {
		return 0;
	}

	const levels = new Float32Array(windows);
	let peak = 0;
	for (let w = 0; w < windows; w++) {
		const start = w * WINDOW;
		let sum = 0;
		for (let i = start; i < start + WINDOW; i++) {
			sum += data[i] * data[i];
		}
		levels[w] = Math.sqrt(sum / WINDOW);
		if (levels[w] > peak) {
			peak = levels[w];
		}
	}

	const threshold = Math.max(peak * RELATIVE_THRESHOLD, NOISE_FLOOR);
	const first = levels.findIndex((level) => level >= threshold);

	if (first <= 0) {
		return 0; // sound starts right away or never rises above floor
	}

	const offset = Math.max(0, first * WINDOW - Math.round(PREROLL * buffer.sampleRate));

	if (buffer.length - offset < WINDOW * 4) {
		return 0; // what is left would be too short to play
	}

	return offset;
};

/**
 * Cuts everything before the offset off. Returns the buffer untouched when the
 * offset leaves nothing to cut, which keeps a restored sample identical to the
 * one that was recorded.
 */
export const sliceFrom = (buffer: AudioBuffer, offset: number, ctx: BaseAudioContext): AudioBuffer => {
	if (offset <= 0 || offset >= buffer.length) {
		return buffer;
	}

	const trimmed = ctx.createBuffer(buffer.numberOfChannels, buffer.length - offset, buffer.sampleRate);
	for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
		trimmed.getChannelData(channel).set(buffer.getChannelData(channel).subarray(offset));
	}

	return trimmed;
};
