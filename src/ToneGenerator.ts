import { AudioRecorder } from "./audioRecorder";
import { Waveform } from "./waveform.ts";
import { getFrequency } from "./getFrequency.ts";
import { MyAudioNode } from "./AudioNode.ts";
import { createSynthControls } from "./createSynthControls.ts";
import { Controls } from "./Controls.ts";
import { Sampler } from "./Sampler.ts";
import { flatWaveformPoints, waveformPoints } from "./waveformPoints.ts";
import { canPlaySamples, loadSamplePlayer, SamplePlayer } from "./SamplePlayer.ts";
import { DriveChain } from "./DriveChain.ts";

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
	sampler: Sampler;
	sampleOption!: HTMLElement;
	drive: DriveChain;

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
		this.sampler = new Sampler(this.ctx);
		this.sampler.onFrame = (data) => this.drawSampleWave(data);
		/* has to exist before the controls, they push their initial values into it */
		this.drive = new DriveChain(this.ctx, this.audioRecorder.master);
		this.controls = this.createControls();
	}

	/**
	 * Called when a note starts playing
	 *
	 * @param {String} key
	 */
	playNote(key = "a", velocity = 1, pitchBend = 0.5): void {
		const vel = this.ctx.createGain();
		const release = this.ctx.createGain();
		const freq = getFrequency(key, this.pitch);
		const attack = this.ctx.createGain();
		const decay = this.ctx.createGain();

		let node: AudioBufferSourceNode | OscillatorNode | SamplePlayer;

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
		} else if (this.wave === "sample") {
			// todo: own function
			if (!this.sampler.buffer) {
				return; // nothing recorded yet
			}

			const rate = this.getPlaybackRate(freq);
			// the grain player keeps the sample's length, resampling alone would not
			const sample = canPlaySamples(this.ctx)
				? new SamplePlayer(
						this.ctx,
						this.sampler.buffer,
						rate,
						this.sampler.note ? this.sampler.frequency : 0 // no note means the pitch was guessed
				  )
				: new AudioBufferSourceNode(this.ctx, {
						buffer: this.sampler.buffer,
						playbackRate: rate,
				  });

			sample.connect(attack);

			node = sample;
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

		vel.gain.value = vel.gain.value * velocity;

		/* configure release */
		attack.connect(decay);
		decay.connect(vel);
		vel.connect(release);
		release.connect(this.drive.input);

		/* apply pre-existing pitch bend */
		if (node instanceof OscillatorNode) {
			node.frequency.setValueAtTime(freq * (0.5 + pitchBend), this.ctx.currentTime);
		} else if (this.wave === "sample") {
			node.playbackRate.setValueAtTime(this.getPlaybackRate(freq * (0.5 + pitchBend)), this.ctx.currentTime);
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

		// clean up
		window.setTimeout(() => {
			node.node.stop(this.ctx.currentTime + Math.max(this.release, this.threshold));
			release.disconnect();
		}, (this.release + this.threshold) * 1000);

		Object.keys(this.nodes).forEach((key) => {
			if (this.nodes[key] === node) {
				delete this.nodes[key];
			}
		});
	}

	pitchBend(offset: number): void {
		if (offset < 0 || offset > 1) {
			throw new Error("Pitch offset must be between 0 and 1");
		}

		Object.keys(this.nodes).forEach((note) => {
			const node = this.nodes[note].node;
			const baseFreq = getFrequency(note, this.pitch) * (0.5 + offset);

			if (node instanceof OscillatorNode) {
				node.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
			} else if (this.wave === "sample") {
				node.playbackRate.setValueAtTime(this.getPlaybackRate(baseFreq), this.ctx.currentTime);
			}
			// noise has no frequency to bend
		});
	}

	getPlaybackRate(frequency: number): number {
		return Math.min(Math.max(frequency / this.sampler.frequency, 1 / 32), 32);
	}

	async toggleSampling(): Promise<void> {
		if (this.sampler.pending) {
			return; // still opening the microphone, or still decoding the last take
		}

		if (this.sampler.recording) {
			await this.stopSampling();
			return;
		}

		/* runs while the mic is still recording, so it is ready for the first note */
		loadSamplePlayer(this.ctx).catch((e) => console.error("Could not load the sample player.", e));

		this.wave = "sample";
		this.updateSampleControls(true);
		this.drawSampleWave(); // clear the previous sample, the mic takes over from here
		this.drawAdsr();

		try {
			await this.sampler.start();
		} catch (e) {
			console.error("Could not access the microphone.", e);
			this.updateSampleControls(false);
			if (!this.sampler.buffer) {
				this.selectWave("sine");
			}
		}
	}

	async stopSampling(): Promise<void> {
		await this.sampler.stop();
		this.updateSampleControls(false);
		this.drawSample();
	}

	updateSampleControls(recording: boolean): void {
		this.sampleOption.dataset.recording = recording.toString();
		(this.sampleOption.querySelector(".sample-text") as HTMLElement).textContent = recording
			? "Sampling"
			: "Sample";
		(this.sampleOption.querySelector(".icon-mic") as HTMLElement).hidden = recording;
		(this.sampleOption.querySelector(".icon-rec") as HTMLElement).hidden = !recording;

		const label = this.sampleOption.querySelector("label") as HTMLLabelElement;
		if (recording) {
			label.removeAttribute("title");
		} else if (this.sampler.buffer) {
			label.title = this.sampler.note ? `Sampled at ${this.sampler.note}` : "Sampled at an unknown pitch";
		}
	}

	drawSampleWave(data?: Float32Array): void {
		this.headerDiagram
			.querySelector("#wave-sample")
			?.setAttribute("points", data && data.length ? waveformPoints(data) : flatWaveformPoints());
	}

	drawSample(): void {
		this.drawSampleWave(this.sampler.buffer?.getChannelData(0));
	}

	selectWave(wave: Waveform): void {
		const input = this.controls.el.querySelector(`#waveform-${wave}-${this.id}`) as HTMLInputElement | null;
		if (!input) {
			return;
		}

		input.checked = true;
		input.dispatchEvent(new Event("input", { bubbles: true }));
	}

	createControls(): Controls {
		const html = createSynthControls(this.id);

		// create dom node from html string
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, "text/html");
		const el = doc.querySelector(`#synth-controls-${this.id}`) as HTMLFormElement;

		// append controls to DOM
		document.querySelector(".controls-slider")?.appendChild(el);

		this.sampleOption = el.querySelector(".sample-option") as HTMLElement;

		const sampleInput = el.querySelector(`#waveform-sample-${this.id}`) as HTMLInputElement;
		sampleInput.addEventListener("click", () => {
			this.toggleSampling();
		});

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

			this.drive.setVolume(this.volume / 100);
			this.drive.setDrive(this.overdrive / 100, this.distort / 100);

			if (this.wave !== "sample" && this.sampler.recording) {
				this.stopSampling(); // switching away mid-recording still keeps the sample
			}

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

		if (this.wave === "sample" && !this.sampler.recording) {
			// the header is shared, so this generator's sample has to be redrawn
			this.drawSample();
		}

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
			node.node.stop(this.ctx.currentTime + Math.max(this.release, this.threshold));
			node.release.disconnect();
			node.release.gain.cancelScheduledValues(this.ctx.currentTime);
		});

		this.nodes = {};
		this.drive.destroy();
		this.sampler.destroy();
		this.controls.el.remove();

		localStorage.removeItem(`synth-controls-${this.id}`);
	}
}
