const PROCESSOR = "granular-sampler";
const WORKLET_URL = "./samplePlayer.worklet.js";

const loading = new WeakMap<BaseAudioContext, Promise<void>>();
const loaded = new WeakSet<BaseAudioContext>();

export const loadSamplePlayer = (ctx: BaseAudioContext): Promise<void> => {
	let pending = loading.get(ctx);
	if (!pending) {
		pending = ctx.audioWorklet.addModule(WORKLET_URL).then(() => {
			loaded.add(ctx);
		});
		loading.set(ctx, pending);
	}

	return pending;
};

export const canPlaySamples = (ctx: BaseAudioContext): boolean => loaded.has(ctx);

export class SamplePlayer extends AudioWorkletNode {
	constructor(ctx: BaseAudioContext, buffer: AudioBuffer, rate: number, frequency: number) {
		super(ctx, PROCESSOR, {
			numberOfInputs: 0,
			numberOfOutputs: 1,
			outputChannelCount: [1],
			processorOptions: {
				sample: buffer.getChannelData(0).slice(),
				period: frequency > 0 ? buffer.sampleRate / frequency : 0,
			},
		});

		this.playbackRate.value = rate;
	}

	get playbackRate(): AudioParam {
		return this.parameters.get("rate")!;
	}

	start(): void {
		// the processor runs from the moment it is created
	}

	stop(when = 0): void {
		const delay = Math.max(0, when - this.context.currentTime) * 1000;
		window.setTimeout(() => {
			this.port.postMessage("stop");
			this.disconnect();
		}, delay);
	}
}
