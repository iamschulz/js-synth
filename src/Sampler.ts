import { detectFrequency, frequencyToNoteName } from "./pitch.ts";
import { findSampleStart, sliceFrom } from "./trimSample.ts";
import { deleteSample, loadSample, saveSample } from "./sampleStore.ts";

const DEFAULT_FREQUENCY = 261.63; // Fallback base pitch (C4)

export class Sampler {
	ctx: AudioContext;
	id: string; // keys the sample in storage, one per tone generator
	buffer: AudioBuffer | null;
	frequency: number; // Base frequency the sample plays back at unaltered
	note: string | null; // Detected note name
	recording: boolean;
	pending: boolean; // Called with time domain data on every frame while recording
	onFrame: ((data: Float32Array) => void) | null;

	private stream: MediaStream | null;
	private source: MediaStreamAudioSourceNode | null;
	private analyser: AnalyserNode | null;
	private recorder: MediaRecorder | null;
	private chunks: Blob[];
	private frame: number;

	constructor(ctx: AudioContext, id: string) {
		this.ctx = ctx;
		this.id = id;
		this.buffer = null;
		this.frequency = DEFAULT_FREQUENCY;
		this.note = null;
		this.recording = false;
		this.pending = false;
		this.onFrame = null;
		this.stream = null;
		this.source = null;
		this.analyser = null;
		this.recorder = null;
		this.chunks = [];
		this.frame = 0;
	}

	async start(): Promise<void> {
		if (this.recording || this.pending) {
			return;
		}

		this.pending = true;

		try {
			this.stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: false,
					noiseSuppression: false,
					autoGainControl: false,
				},
			});
		} catch (e) {
			this.pending = false;
			throw e;
		}

		if (this.ctx.state === "suspended") {
			await this.ctx.resume();
		}

		this.source = this.ctx.createMediaStreamSource(this.stream);
		this.analyser = this.ctx.createAnalyser();
		this.analyser.fftSize = 2048;
		this.source.connect(this.analyser);

		this.chunks = [];
		this.recorder = new MediaRecorder(this.stream);
		this.recorder.addEventListener("dataavailable", (e) => {
			if (e.data.size > 0) {
				this.chunks.push(e.data);
			}
		});
		this.recorder.start();

		this.recording = true;
		this.pending = false;
		this.watch();
	}

	async stop(): Promise<void> {
		if (!this.recording) {
			return;
		}

		this.recording = false;
		this.pending = true;
		window.cancelAnimationFrame(this.frame);

		const recorder = this.recorder;
		const blob = await new Promise<Blob | null>((resolve) => {
			if (!recorder || recorder.state === "inactive") {
				resolve(null);
				return;
			}
			recorder.addEventListener("stop", () => resolve(new Blob(this.chunks, { type: recorder.mimeType })), {
				once: true,
			});
			recorder.stop();
		});

		this.teardown();

		try {
			if (!blob || blob.size === 0) {
				return;
			}

			const decoded = await this.ctx.decodeAudioData(await blob.arrayBuffer());
			const offset = findSampleStart(decoded);
			this.buffer = sliceFrom(decoded, offset, this.ctx);

			const frequency = detectFrequency(this.buffer);
			this.frequency = frequency || DEFAULT_FREQUENCY;
			this.note = frequency ? frequencyToNoteName(frequency) : null;

			saveSample(this.id, {
				blob,
				frequency: this.frequency,
				note: this.note,
				trimOffset: offset,
			}).catch((e) => console.error("Could not store the sample.", e));
		} catch (e) {
			console.error("Could not decode the recorded sample.", e);
		} finally {
			this.pending = false;
		}
	}

	async restore(): Promise<boolean> {
		if (this.buffer || this.recording || this.pending) {
			return false; // a fresh recording always wins over the stored one
		}

		let stored;
		try {
			stored = await loadSample(this.id);
		} catch (e) {
			console.error("Could not read the stored sample.", e);
			return false;
		}

		if (!stored || this.buffer || this.recording || this.pending) {
			return false;
		}

		this.pending = true;
		try {
			const decoded = await this.ctx.decodeAudioData(await stored.blob.arrayBuffer());
			this.buffer = sliceFrom(decoded, stored.trimOffset, this.ctx);
			this.frequency = stored.frequency;
			this.note = stored.note;
			return true;
		} catch (e) {
			console.error("Could not decode the stored sample.", e);
			return false;
		} finally {
			this.pending = false;
		}
	}

	forget(): void {
		deleteSample(this.id).catch((e) => console.error("Could not delete the stored sample.", e));
	}

	destroy(): void {
		this.recording = false;
		this.pending = false;
		window.cancelAnimationFrame(this.frame);

		if (this.recorder && this.recorder.state !== "inactive") {
			this.recorder.stop();
		}

		this.teardown();
		this.buffer = null;
	}

	private watch(): void {
		const data = new Float32Array(this.analyser!.fftSize);

		const tick = () => {
			if (!this.recording || !this.analyser) {
				return;
			}
			this.analyser.getFloatTimeDomainData(data);
			this.onFrame?.(data);
			this.frame = window.requestAnimationFrame(tick);
		};

		this.frame = window.requestAnimationFrame(tick);
	}

	private teardown(): void {
		this.source?.disconnect();
		this.analyser?.disconnect();
		this.stream?.getTracks().forEach((track) => track.stop());
		this.source = null;
		this.analyser = null;
		this.stream = null;
		this.recorder = null;
		this.chunks = [];
	}
}
