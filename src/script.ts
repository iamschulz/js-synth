import { AudioRecorder } from "./audioRecorder";
import { Waveform } from "./waveform.ts";
import { MidiAdapter } from "./midi.ts";
import { getKeyName, getNote } from "./keys.ts";

type AudioNode = {
	node: OscillatorNode | AudioBufferSourceNode;
	release: GainNode;
};

class Main {
	ctx: AudioContext;
	keys: {
		[key: string]: {
			key: string;
			midiIn: number;
		};
	};
	volume: number;
	wave: Waveform;
	threshold: number;
	attack: number;
	decay: number;
	sustain: number;
	release: number;
	pitch: number;
	nodes: { [key: string]: AudioNode };
	keyBtns: NodeListOf<HTMLButtonElement>;
	controls: HTMLFormElement;
	headerDiagram: SVGElement;
	MidiAdapter: MidiAdapter;
	midiIn: number;
	midiOut: number;
	AudioRecorder: AudioRecorder;

	constructor() {
		if (!window.AudioContext) {
			(document.querySelector("dialog") as HTMLDialogElement).setAttribute("open", "open");
			return;
		}

		this.ctx = new window.AudioContext();

		this.volume = 100;
		this.wave = "sine";
		this.threshold = 0.001;
		this.attack = 0;
		this.decay = 0;
		this.sustain = 50;
		this.release = 0;
		this.pitch = 0;
		this.nodes = {};
		this.keyBtns = document.querySelectorAll(".keyboard button");
		this.controls = document.querySelector(".controls")!;
		this.headerDiagram = document.querySelector("#header-vis")!;

		this.keyboardControls();
		this.buttonControls();
		this.optionControls();
		this.updateLegend();

		this.MidiAdapter = new MidiAdapter({
			playCallback: this.onMidiPlay.bind(this),
			releaseCallback: this.onMidiRelease.bind(this),
		});

		this.killDeadNodes();

		this.AudioRecorder = new AudioRecorder(this.ctx);
	}

	/**
	 * Called when a note starts playing
	 *
	 * @param {String} key
	 */
	playNote(key = "a"): void {
		//const ctx = new window.AudioContext();
		const volume = this.ctx.createGain();
		const release = this.ctx.createGain();
		const freq = this.getFrequency(key);
		const attack = this.ctx.createGain();
		const decay = this.ctx.createGain();
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
		attack.connect(decay);

		/* configure decay */
		decay.gain.setValueAtTime(1, this.ctx.currentTime + this.attack);
		decay.gain.exponentialRampToValueAtTime(
			Math.max(this.sustain / 100, 0.000001),
			this.ctx.currentTime + this.attack + this.decay
		);
		decay.connect(release);

		/* applay master volume */
		volume.gain.value = volume.gain.value * (this.volume / 100);
		release.connect(volume);

		/* configure release */
		volume.connect(this.ctx.destination);
		if (this.AudioRecorder.recordingStream) {
			volume.connect(this.AudioRecorder.recordingStream);
		}

		node.start(0);

		Array.from(this.keyBtns)
			.filter((btn) => btn.dataset.note === key)[0]
			?.classList.add("active");

		this.nodes[key] = {
			node: node,
			release: release,
		};

		this.MidiAdapter.onPlayNote(key, 1);
	}

	/**
	 * Called when a node stops playing
	 *
	 * @param {Object} node
	 */
	endNote(node: AudioNode): void {
		const release = node.release;

		/* configure release */
		release.gain.setValueAtTime(0.9, this.ctx.currentTime);
		release.gain.exponentialRampToValueAtTime(
			0.00001,
			this.ctx.currentTime + Math.max(this.release, this.threshold)
		);

		Object.keys(this.nodes).forEach((key) => {
			if (this.nodes[key] === node) {
				Array.from(this.keyBtns)
					.filter((btn) => btn.dataset.note === key)[0]
					?.classList.remove("active");

				delete this.nodes[key];

				this.MidiAdapter.onPlayNote(key, 0);
			}
		});
	}

	getFrequency(note: string): number {
		const semitoneMap: Record<string, number> = {
			c: 0,
			cs: 1,
			db: 1,
			d: 2,
			ds: 3,
			eb: 3,
			e: 4,
			f: 5,
			fs: 6,
			gb: 6,
			g: 7,
			gs: 8,
			ab: 8,
			a: 9,
			as: 10,
			bb: 10,
			b: 11,
		};

		const match = note.toLowerCase().match(/^([a-g]{1}s?|[a-g]{1}b?)(\d?)$/);

		if (!match) {
			throw new Error("Ungültiger Notenname: " + note);
		}

		const [, baseNote, octaveStr] = match;
		const semitone = semitoneMap[baseNote];
		const octave = octaveStr === "" ? 4 : parseInt(octaveStr);

		const semitonesFromA4 = semitone + (octave - 4) * 12 - 9;

		let freq = +(440 * Math.pow(2, semitonesFromA4 / 12)).toFixed(2);

		for (let i = 0; i <= this.pitch; i++) {
			freq = freq * 2;
		}

		return freq;
	}

	/**
	 * Listens to keyboard inputs.
	 */
	keyboardControls(): void {
		document.addEventListener("keydown", (e) => {
			const recordingsList = document.querySelector("#recordingsList") as HTMLElement;
			if (recordingsList.contains(document.activeElement)) {
				if (e.code === "KeyI") {
					const time = this.AudioRecorder.recordings[0].audioEl.currentTime;
					this.AudioRecorder.recordings[0].setInpoint(time);
				}
				if (e.code === "KeyO") {
					const time = this.AudioRecorder.recordings[0].audioEl.currentTime;
					this.AudioRecorder.recordings[0].setOutpoint(time);
				}
				if (e.code === "Space" && (e.target as HTMLElement).classList.contains("audioScrub")) {
					e.preventDefault();
					this.AudioRecorder.recordings[0].togglePlay();
				}
			} else {
				const note = getNote(e.code);

				if (!note) {
					return;
				}

				if (
					this.nodes[note] // note is already playing
				) {
					return;
				}

				this.playNote(note);
			}
		});

		document.addEventListener("keyup", (e) => {
			const note = getNote(e.code);

			if (!note) {
				return;
			}

			if (!this.nodes[note]) return;

			this.endNote(this.nodes[note]);
		});
	}

	/**
	 * Calback for MIDI inputs for key presses.
	 *
	 * @param midiCode - Code of the key.
	 * @param velocity - Velocity of the key.
	 *
	 * @returns
	 */
	onMidiPlay(midiCode: number, velocity: number): void {
		const note = getNote(midiCode);

		if (!note) {
			return;
		}

		if (
			this.nodes[note] // note is already playing
		)
			return;

		this.playNote(note);
	}

	/**
	 * Calback for MIDI inputs for key releases.
	 *
	 * @param midiCode - Code of the key.
	 *
	 * @returns
	 */
	onMidiRelease(midiCode: number): void {
		const note = getNote(midiCode);

		if (!note) {
			return;
		}

		if (!this.nodes[note]) return;

		this.endNote(this.nodes[note]);
	}

	/**
	 * Handles on-screen button inputs.
	 */
	buttonControls(): void {
		this.keyBtns.forEach((btn) => {
			/*  click button */
			btn.addEventListener(
				"mousedown",
				(e) => {
					const key = btn.dataset.note;
					if (!key) return;

					this.playNote(key);
				},
				{ passive: true }
			);

			btn.addEventListener(
				"touchstart",
				(e) => {
					const key = btn.dataset.note;
					if (!key) return;

					this.playNote(key);
				},
				{ passive: true }
			);

			/* change button while clicked */
			btn.addEventListener(
				"mouseenter",
				(e) => {
					const key = btn.dataset.note;
					if (!e.buttons || !key) return;

					this.playNote(key);
				},
				{ passive: true }
			);

			/* trigger button with tab controls */
			btn.addEventListener("keydown", (e) => {
				if (!(e.code === "Space" || e.key === "Enter")) return;

				this.playNote((e.target as HTMLButtonElement).dataset.note);
			});

			/* release button */
			btn.addEventListener(
				"mouseup",
				(e) => {
					const key = btn.dataset.note;
					if (!key || !this.nodes[key]) return;

					this.endNote(this.nodes[key]);
				},
				{ passive: true }
			);

			btn.addEventListener(
				"mouseout",
				(e) => {
					const key = btn.dataset.note;
					if (!key || !this.nodes[key]) return;

					this.endNote(this.nodes[key]);
				},
				{ passive: true }
			);

			btn.addEventListener(
				"touchend",
				(e) => {
					const key = btn.dataset.note;
					if (!key || !this.nodes[key]) return;

					this.endNote(this.nodes[key]);
				},
				{ passive: true }
			);

			btn.addEventListener(
				"touchcancel",
				(e) => {
					const key = btn.dataset.note;
					if (!key || !this.nodes[key]) return;

					this.endNote(this.nodes[key]);
				},
				{ passive: true }
			);

			btn.addEventListener("keyup", (e) => {
				const key = btn.dataset.note;
				if (!(e.code === "Space" || e.key === "Enter")) return;
				if (!key || !this.nodes[key]) return;

				this.endNote(this.nodes[key]);
			});

			btn.addEventListener("blur", () => {
				const key = btn.dataset.note;
				if (!key || !this.nodes[key]) return;

				this.endNote(this.nodes[key]);
			});
		});
	}

	/**
	 * Applies synth option changes.
	 */
	optionControls(): void {
		const applyOptions = () => {
			const data = Object.fromEntries(new FormData(this.controls)) as any;
			this.wave = data.waveform || "sine";
			this.volume = parseFloat(data.volume || 99);
			this.attack = parseFloat(data.attack || 0) + 0.001;
			this.decay = parseFloat(data.decay || 0) + 0.001;
			this.sustain = parseFloat(data.sustain || 50);
			this.release = parseFloat(data.release || 0) + 0.001;
			this.pitch = parseInt(data.pitch || 3);
			this.midiIn = parseInt(data.midiIn) || 0;
			this.midiOut = parseInt(data.midiOut) || 0;
			this.drawWave();
			this.drawAdsr();

			localStorage.synthConfig = JSON.stringify({
				wave: this.wave,
				volume: this.volume,
				attack: this.attack,
				decay: this.decay,
				sustain: this.sustain,
				release: this.release,
				pitch: this.pitch,
				midiIn: this.midiIn,
				midiOut: this.midiOut,
			});
		};

		this.controls.addEventListener("change", () => {
			applyOptions();
		});

		this.restoreConfig();

		applyOptions();
	}

	/**
	 * Restores synth options from localstorage.
	 *
	 * @returns
	 */
	restoreConfig(): void {
		if (!localStorage.synthConfig) return;

		const synthConfig = JSON.parse(localStorage.synthConfig);
		Object.keys(synthConfig).map((conf) => {
			this[synthConfig] = synthConfig[conf];

			if (conf === "wave") {
				const waveformEl = this.controls.querySelector(
					`[name=waveform][value=${synthConfig[conf]}`
				) as HTMLInputElement;
				waveformEl.setAttribute("checked", "checked");
			} else {
				const waveformEl = this.controls.querySelector(`#${conf}`) as HTMLInputElement;
				waveformEl.value = synthConfig[conf];
			}
		});
	}

	/**
	 * Draws the waveform.
	 */
	drawWave(): void {
		const waveDiagrams = this.headerDiagram.querySelectorAll('[id^="wave"]');
		waveDiagrams.forEach((waveDiagram) => {
			waveDiagram.toggleAttribute("hidden", waveDiagram.id !== `wave-${this.wave}`);
		});
	}

	/**
	 * Draws the ADSR diagram.
	 */
	drawAdsr(): void {
		// header diagram is 400 x 200
		const a = this.headerDiagram.querySelector("#adsr-a")!;
		const d = this.headerDiagram.querySelector("#adsr-d")!;
		const s = this.headerDiagram.querySelector("#adsr-s")!;
		const r = this.headerDiagram.querySelector("#adsr-r")!;

		const ax = this.attack * 50 - 0.05;
		const dx = (this.decay - 0.001) * 20 + ax;
		const sy = 200 - this.sustain * 2;
		const rx = 400 - this.release * 10 + 0.01;

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

	/**
	 *
	 * @returns Updates the legend on the on-screen keys according to the users keymap.
	 */
	async updateLegend(): Promise<void> {
		if (!navigator.keyboard?.getLayoutMap) {
			return;
		}

		const layoutMap = await navigator.keyboard.getLayoutMap();
		this.keyBtns.forEach((btn) => {
			const noteName = btn.dataset.note;
			const keyName = getKeyName(noteName!);
			if (!keyName) return;
			btn.textContent = layoutMap.get(keyName) || keyName;
		});
	}

	killDeadNodes(): void {
		if (
			this.MidiAdapter.disabled ||
			this.MidiAdapter.activeNotes === 0 ||
			!document.querySelector("button.active")
		) {
			Object.keys(this.nodes).forEach((note) => {
				this.endNote(this.nodes[note]);
			});
		}

		window.setTimeout(() => {
			window.requestAnimationFrame(() => {
				this.killDeadNodes();
			});
		}, 100);
	}
}

// start synth
window.Main = new Main();

// register sw
window.onload = () => {
	"use strict";
	if ("serviceWorker" in navigator) {
		navigator.serviceWorker.register("./sw.js");
	}
};
