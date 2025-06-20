import { AudioRecorder } from "./audioRecorder";
import { Waveform } from "./waveform.ts";
import { getFrequency } from "./getFrequency.ts";
import { MyAudioNode } from "./AudioNode.ts";
import { createSynthControls } from "./createSynthControls.ts";
import { Controls } from "./Controls.ts";

export class ToneGenerator {
	id: string;
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
	controls: Controls;
	headerDiagram: SVGElement;

	constructor(id: string, audioRecorder: AudioRecorder, ctx: AudioContext, headerDiagram: SVGElement) {
		this.id = id;
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
		this.headerDiagram = headerDiagram;
		this.controls = this.createControls();
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

	createControls(): Controls {
		const html = createSynthControls(this.id);

		// create dom node from html string
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, "text/html");
		const el = doc.querySelector(`#synth-controls-${this.id}`) as HTMLFormElement;

		// append controls to DOM
		document.querySelector(".controls-slider")?.appendChild(el);

		const controls = new Controls(`synth-controls-${this.id}`, el, (data) => {
			this.volume = parseFloat(data[`volume-${this.id}`] as string);
			this.wave = data[`waveform-${this.id}`] as Waveform;
			this.pitch = parseFloat(data[`pitch-${this.id}`] as string);
			this.attack = parseFloat(data[`attack-${this.id}`] as string);
			this.decay = parseFloat(data[`decay-${this.id}`] as string);
			this.sustain = parseFloat(data[`sustain-${this.id}`] as string);
			this.release = parseFloat(data[`release-${this.id}`] as string);
			this.distort = parseFloat(data[`distort-${this.id}`] as string);
			this.overdrive = parseFloat(data[`overdrive-${this.id}`] as string);

			this.drawAdsr();
		});

		return controls;
	}

	/**
	 * Draws the ADSR diagram.
	 */
	drawAdsr(): void {
		// todo: animate programmatic changes

		// Draws the waveform.
		const waveDiagrams = this.headerDiagram.querySelectorAll('[id^="wave"]');
		waveDiagrams.forEach((waveDiagram) => {
			waveDiagram.toggleAttribute("hidden", waveDiagram.id !== `wave-${this.wave}`);
		});

		// header diagram is 400 x 200
		const a = this.headerDiagram.querySelector("#adsr-a")!;
		const d = this.headerDiagram.querySelector("#adsr-d")!;
		const s = this.headerDiagram.querySelector("#adsr-s")!;
		const r = this.headerDiagram.querySelector("#adsr-r")!;

		const ax = this.attack * 50 - 0.0;
		const dx = (this.decay - 0.0) * 20 + ax;
		const sy = 200 - this.sustain * 2;
		const rx = 400 - this.release * 10 + 0.0;

		a.toggleAttribute("hidden", ax === 0);
		a.setAttribute("x2", ax.toString());

		d.toggleAttribute("hidden", dx === 0);
		d.setAttribute("x1", ax.toString());
		d.setAttribute("x2", dx.toString());
		d.setAttribute("y2", sy.toString());

		s.setAttribute("x1", dx.toString());
		s.setAttribute("y1", sy.toString());
		s.setAttribute("x2", rx.toString());
		s.setAttribute("y2", sy.toString());

		r.toggleAttribute("hidden", rx === 400);
		r.setAttribute("x1", rx.toString());
		r.setAttribute("y1", sy.toString());
	}

	destroy(): void {
		Object.keys(this.nodes).forEach((key) => {
			const node = this.nodes[key];
			if (node.node instanceof AudioBufferSourceNode) {
				node.node.stop();
			} else if (node.node instanceof OscillatorNode) {
				node.node.stop();
			}
			node.release.disconnect();
			node.release.gain.cancelScheduledValues(this.ctx.currentTime);
		});

		this.nodes = {};
		this.controls.el.remove();

		localStorage.removeItem(`synth-controls-${this.id}`);
	}
}
