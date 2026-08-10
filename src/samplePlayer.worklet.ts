export {}; // keeps the ambient declarations below out of the global scope

declare abstract class AudioWorkletProcessor {
	readonly port: MessagePort;
	constructor();
}

declare function registerProcessor(name: string, processor: unknown): void;

type ProcessorOptions = {
	processorOptions?: {
		sample?: Float32Array;
		period?: number;
	};
};

type Grain = {
	pos: number; // read position in the sample, moves at the playback rate
	phase: number; // frames since the grain started, GRAIN once it is spent
	head: boolean; // the first grain, which must not fade in
};

const GRAIN = 2048; // frames per grain, roughly 45ms at 44.1kHz
const HOP = GRAIN / 2; // grains overlap by half, so their Hann windows sum to exactly 1

class GranularSamplerProcessor extends AudioWorkletProcessor {
	static get parameterDescriptors() {
		return [
			{
				name: "rate",
				defaultValue: 1,
				minValue: 1 / 32,
				maxValue: 32,
				automationRate: "a-rate",
			},
		];
	}

	private sample: Float32Array;
	private period: number; // frames per cycle of the sampled note, 0 if it has no pitch
	private window: Float32Array;
	private grains: Grain[];
	private playhead: number; // one frame per output frame, this is what keeps the length
	private countdown: number; // frames until the next grain starts
	private done: boolean;

	constructor(options?: ProcessorOptions) {
		super();

		this.sample = options?.processorOptions?.sample || new Float32Array(0);
		this.period = options?.processorOptions?.period || 0;
		this.window = new Float32Array(GRAIN);
		for (let i = 0; i < GRAIN; i++) {
			this.window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / GRAIN));
		}

		this.grains = [
			{ pos: 0, phase: GRAIN, head: false },
			{ pos: 0, phase: GRAIN, head: false },
		];
		this.playhead = 0;
		this.countdown = 0;
		this.done = this.sample.length === 0;

		this.port.onmessage = (e) => {
			if (e.data === "stop") {
				this.done = true;
			}
		};
	}

	/* linear interpolation, since the read position lands between frames */
	private read(pos: number): number {
		const i = Math.floor(pos);
		if (i < 0 || i + 1 >= this.sample.length) {
			return 0;
		}

		const fraction = pos - i;
		return this.sample[i] * (1 - fraction) + this.sample[i + 1] * fraction;
	}

	/**
	 * Nudges a starting grain onto the same point in the waveform as the grain
	 * it overlaps with, at most half a cycle away from where it was due. Without
	 * that the two read positions drift apart once the rate leaves 1 and the
	 * overlap cancels itself out.
	 */
	private align(pos: number, previous: Grain): number {
		if (this.period < 2 || previous.phase >= GRAIN) {
			return pos;
		}

		const cycles = Math.round((previous.pos - pos) / this.period);
		return Math.max(0, previous.pos - cycles * this.period);
	}

	process(_inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
		if (this.done) {
			return false;
		}

		const out = outputs[0][0];
		const rates = parameters.rate;

		for (let i = 0; i < out.length; i++) {
			/* start the next grain where the playhead currently stands */
			if (this.countdown <= 0 && this.playhead < this.sample.length) {
				const spent = this.grains[0].phase >= GRAIN ? 0 : 1;
				const grain = this.grains[spent];
				const previous = this.grains[1 - spent];

				grain.pos = this.align(this.playhead, previous);
				grain.phase = 0;
				grain.head = this.playhead === 0;
				this.countdown = HOP;
			}

			const rate = rates.length > 1 ? rates[i] : rates[0];
			let sum = 0;
			let active = false;

			for (const grain of this.grains) {
				if (grain.phase >= GRAIN) {
					continue;
				}

				// the very first grain skips its fade-in, so the attack survives
				const gain = grain.head && grain.phase < HOP ? 1 : this.window[grain.phase];
				sum += gain * this.read(grain.pos);
				grain.pos += rate;
				grain.phase++;
				active = true;
			}

			out[i] = sum;
			this.playhead++;
			this.countdown--;

			if (!active && this.playhead >= this.sample.length) {
				this.done = true;
				break;
			}
		}

		return !this.done;
	}
}

registerProcessor("granular-sampler", GranularSamplerProcessor);
