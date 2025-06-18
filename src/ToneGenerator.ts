import { AudioRecorder } from "./audioRecorder";
import { Waveform } from "./waveform.ts";
import { getFrequency } from "./getFrequency.ts";
import { MyAudioNode } from "./AudioNode.ts";

export class ToneGenerator {
	ctx: AudioContext;
	audioRecorder: AudioRecorder;
	volume: number;
	wave: Waveform;
	pitch: number;
	threshold: number;
	attack: number;
	decay: number;
	sustain: number;
	release: number;
	distort: number;
	overdrive: number;
	nodes: { [key: string]: MyAudioNode };

	constructor(audioRecorder: AudioRecorder, ctx: AudioContext) {
		this.ctx = ctx;
		this.audioRecorder = audioRecorder;
		this.volume = 100;
		this.wave = "sine";
		this.pitch = 0;
		this.threshold = 0.001;
		this.attack = 0;
		this.decay = 0;
		this.sustain = 50;
		this.release = 0;
		this.distort = 0;
		this.overdrive = 0;
		this.nodes = {};
	}

	makeDistortionCurve() {
		const k = typeof this.distort === "number" ? this.distort : 50;
		const n_samples = 44100;
		const curve = new Float32Array(n_samples);
		const deg = Math.PI / 180;

		for (let i = 0; i < n_samples; i++) {
			const x = (i * 2) / n_samples - 1;
			curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
		}
		return curve;
	}

	makeOverdriveCurve() {
		const k = typeof this.overdrive === "number" ? this.overdrive : 3;
		const n_samples = 44100;
		const curve = new Float32Array(n_samples);

		for (let i = 0; i < n_samples; i++) {
			const x = (i * 2) / n_samples - 1;
			// Soft clipping using tanh-like curve
			curve[i] = Math.tanh(k * x);
		}

		return curve;
	}

	/**
	 * Called when a note starts playing
	 *
	 * @param {String} key
	 */
	playNote(key = "a", velocity = 1, pitchBend = 0.5): void {
		const vel = this.ctx.createGain();
		const volume = this.ctx.createGain();
		const release = this.ctx.createGain();
		const freq = getFrequency(key, this.pitch);
		const attack = this.ctx.createGain();
		const decay = this.ctx.createGain();
		let distortion: WaveShaperNode | undefined;
		let overdriveAmp: WaveShaperNode | undefined;

		let node: AudioBufferSourceNode | OscillatorNode;

		if (["sine", "triangle", "square", "sawtooth"].includes(this.wave)) {
			// todo: own function
			const osc = this.ctx.createOscillator();
			osc.type = this.wave as OscillatorType;
			osc.connect(attack);
			osc.frequency.value = freq;

			node = osc;
		} else if (this.wave === "noise") {
			// todo: own function
			const bufSize = this.ctx.sampleRate * 10;
			const buf = new AudioBuffer({
				length: bufSize,
				sampleRate: this.ctx.sampleRate,
			});

			const data = buf.getChannelData(0);
			for (let i = 0; i < bufSize; i++) {
				data[i] = Math.random() * 2 - 1;
			}

			const noise = new AudioBufferSourceNode(this.ctx, {
				buffer: buf,
			});

			const bandpass = new BiquadFilterNode(this.ctx, {
				type: "bandpass",
				frequency: freq,
			});

			noise.connect(bandpass).connect(attack);

			node = noise;
		} else {
			return;
		}

		/* configure attack */
		attack.gain.setValueAtTime(0.00001, this.ctx.currentTime);
		if (this.attack > this.threshold) {
			attack.gain.exponentialRampToValueAtTime(0.9, this.ctx.currentTime + this.threshold + this.attack);
		} else {
			attack.gain.exponentialRampToValueAtTime(0.9, this.ctx.currentTime + this.threshold);
		}

		/* configure decay */
		decay.gain.setValueAtTime(1, this.ctx.currentTime + this.attack);
		decay.gain.exponentialRampToValueAtTime(
			Math.max(this.sustain / 100, 0.000001),
			this.ctx.currentTime + this.attack + this.decay
		);

		/* apply distortion */
		if (this.distort > 0) {
			distortion = this.ctx.createWaveShaper();
			distortion.curve = this.makeDistortionCurve();
			distortion.oversample = "2x";
		}

		if (this.overdrive > 0) {
			overdriveAmp = this.ctx.createWaveShaper();
			overdriveAmp.curve = this.makeOverdriveCurve();
			overdriveAmp.oversample = "2x";
		}

		/* apply key velocity */
		vel.gain.value = vel.gain.value * velocity;

		/* applay master volume */
		volume.gain.value = volume.gain.value * (this.volume / 100);

		/* configure release */
		attack.connect(decay);
		decay.connect(vel);
		vel.connect(distortion || overdriveAmp || release);
		distortion?.connect(overdriveAmp || release);
		overdriveAmp?.connect(release);
		release.connect(volume);
		volume.connect(this.ctx.destination);

		if (this.audioRecorder.recordingStream) {
			volume.connect(this.audioRecorder.recordingStream);
		}

		/* apply pre-existing pitch bend */
		if (node instanceof OscillatorNode) {
			node.frequency.setValueAtTime(freq * (0.5 + pitchBend), this.ctx.currentTime);
		}

		this.nodes[key] = {
			node: node,
			release: release,
		};

		node.start(0);
	}

	releaseNote(key: string): void {
		const node = this.nodes[key];
		if (!node) {
			return;
		}

		const release = node.release;
		/* configure release */
		release.gain.setValueAtTime(0.9, this.ctx.currentTime);
		release.gain.exponentialRampToValueAtTime(
			0.00001,
			this.ctx.currentTime + Math.max(this.release, this.threshold)
		);

		Object.keys(this.nodes).forEach((key) => {
			if (this.nodes[key] === node) {
				delete this.nodes[key];
			}
		});
	}

	pitchBend(offset: number): void {
		Object.keys(this.nodes).forEach((note) => {
			if (this.nodes[note].node instanceof AudioBufferSourceNode) {
				// cannot change frequency of AudioBufferSourceNode
				return;
			}
			const node = this.nodes[note].node as OscillatorNode;

			if (offset < 0 || offset > 1) {
				throw new Error("Pitch offset must be between 0 and 1");
			}

			const baseFreq = getFrequency(note, this.pitch);

			node.frequency.setValueAtTime(baseFreq * (0.5 + offset), this.ctx.currentTime);
		});
	}
}
