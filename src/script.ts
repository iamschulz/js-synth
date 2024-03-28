import Freqs from "./freqs.js";
import Keys from "./keys.js";
import { MidiAdapter } from "./midi.js";

type AudioNode = {
	ctx: AudioContext;
	osc: OscillatorNode;
	release: GainNode;
};

class Synth {
	freqs: { [key: string]: number };
	keys: {
		[key: string]: {
			key: string;
			midiIn: number;
		};
	};
	wave: "sine" | "square" | "triangle" | "sawtooth";
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

	constructor() {
		if (!window.AudioContext) {
			(document.querySelector("dialog") as HTMLDialogElement).setAttribute("open", "open");
			return;
		}

		this.freqs = Freqs;
		this.keys = Keys;
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
			playCallback: this.onMidiPlay,
			releaseCallback: this.onMidiRelease,
		});
	}

	/**
	 * Called when a note starts playing
	 *
	 * @param {String} key
	 */
	playNote(key = "a") {
		const ctx = new window.AudioContext();
		const osc = ctx.createOscillator();
		const attack = ctx.createGain();
		const decay = ctx.createGain();
		const release = ctx.createGain();
		const freq = this.getFreq(key);

		/* configure oscillator */
		osc.type = this.wave;
		osc.connect(attack);
		osc.frequency.value = freq;

		/* configure attack */
		attack.gain.setValueAtTime(0.00001, ctx.currentTime);
		if (this.attack > this.threshold) {
			attack.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + this.threshold + this.attack);
		} else {
			attack.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + this.threshold);
		}
		attack.connect(decay);

		/* configure decay */
		decay.gain.setValueAtTime(1, ctx.currentTime + this.attack);
		decay.gain.exponentialRampToValueAtTime(this.sustain / 100, ctx.currentTime + this.attack + this.decay);
		decay.connect(release);

		release.connect(ctx.destination);
		osc.start(0);

		Array.from(this.keyBtns)
			.filter((btn) => btn.dataset.note === key)[0]
			.classList.add("active");

		this.nodes[key] = {
			ctx: ctx,
			osc: osc,
			release: release,
		};

		this.MidiAdapter.onPlayNote(key, 1);
	}

	/**
	 * Called when a node stops playing
	 *
	 * @param {Object} node
	 */
	endNote(node: AudioNode) {
		const ctx = node.ctx;
		const release = node.release;

		/* configure release */
		release.gain.setValueAtTime(0.9, ctx.currentTime);
		release.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + Math.max(this.release, this.threshold));

		window.setTimeout(() => {
			ctx.close();
		}, 1000 * Math.max(this.release, this.threshold));

		Object.keys(this.nodes).forEach((key) => {
			if (this.nodes[key] === node) {
				Array.from(this.keyBtns)
					.filter((btn) => btn.dataset.note === key)[0]
					.classList.remove("active");

				delete this.nodes[key];

				this.MidiAdapter.onPlayNote(key, 0);
			}
		});
	}

	getFreq(key: string) {
		let freq = this.freqs[key] || 440;

		for (let i = 0; i <= this.pitch; i++) {
			freq = freq * 2;
		}

		return freq;
	}

	keyboardControls() {
		document.addEventListener("keydown", (e) => {
			const note = Object.keys(this.keys).find((x) => this.keys[x].key === e.code);

			if (!note) {
				return;
			}

			if (
				!this.keys[note]?.key ||
				this.nodes[note] // note is already playing
			) {
				return;
			}

			this.playNote(note);
		});

		document.addEventListener("keyup", (e) => {
			const note = Object.keys(this.keys).find((x) => this.keys[x].key === e.code);

			if (!note) {
				return;
			}

			if (!this.keys[note]?.key || !this.nodes[note]) return;

			this.endNote(this.nodes[note]);
		});
	}

	onMidiPlay(midiCode: number) {
		const note = Object.keys(this.keys).find((x) => this.keys[x].midiIn === midiCode);

		if (!note) {
			return;
		}

		if (
			!this.keys[note]?.key ||
			this.nodes[note] // note is already playing
		)
			return;

		this.playNote(note);
	}

	onMidiRelease(midiCode: number) {
		const note = Object.keys(this.keys).find((x) => this.keys[x].midiIn === midiCode);

		if (!note) {
			return;
		}

		if (!this.keys[note]?.key || !this.nodes[note]) return;

		this.endNote(this.nodes[note]);
	}

	buttonControls() {
		this.keyBtns.forEach((btn) => {
			/*  click button */
			btn.addEventListener(
				"mousedown",
				(e) => {
					const key = btn.dataset.note;
					if (!key || !this.freqs[key]) return;

					this.playNote(key);
				},
				{ passive: true }
			);

			btn.addEventListener(
				"touchstart",
				(e) => {
					const key = btn.dataset.note;
					if (!key || !this.freqs[key]) return;

					this.playNote(key);
				},
				{ passive: true }
			);

			/* change button while clicked */
			btn.addEventListener(
				"mouseenter",
				(e) => {
					const key = btn.dataset.note;
					if (!e.buttons || !key || !this.freqs[key]) return;

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
					if (!key || !this.freqs[key] || !this.nodes[key]) return;

					this.endNote(this.nodes[key]);
				},
				{ passive: true }
			);

			btn.addEventListener(
				"mouseout",
				(e) => {
					const key = btn.dataset.note;
					if (!key || !this.freqs[key] || !this.nodes[key]) return;

					this.endNote(this.nodes[key]);
				},
				{ passive: true }
			);

			btn.addEventListener(
				"touchend",
				(e) => {
					const key = btn.dataset.note;
					if (!key || !this.freqs[key] || !this.nodes[key]) return;

					this.endNote(this.nodes[key]);
				},
				{ passive: true }
			);

			btn.addEventListener(
				"touchcancel",
				(e) => {
					const key = btn.dataset.note;
					if (!key || !this.freqs[key] || !this.nodes[key]) return;

					this.endNote(this.nodes[key]);
				},
				{ passive: true }
			);

			btn.addEventListener("keyup", (e) => {
				const key = btn.dataset.note;
				if (!(e.code === "Space" || e.key === "Enter")) return;
				if (!key || !this.freqs[key] || !this.nodes[key]) return;

				this.endNote(this.nodes[key]);
			});

			btn.addEventListener("blur", (e) => {
				const key = btn.dataset.note;
				if (!key || !this.freqs[key] || !this.nodes[key]) return;

				this.endNote(this.nodes[key]);
			});
		});
	}

	optionControls() {
		const applyOptions = () => {
			const data = Object.fromEntries(new FormData(this.controls)) as any;
			this.wave = data.waveform || "sine";
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

	restoreConfig() {
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

	drawWave() {
		const waveDiagrams = this.headerDiagram.querySelectorAll('[id^="wave"]');
		waveDiagrams.forEach((waveDiagram) => {
			waveDiagram.toggleAttribute("hidden", waveDiagram.id !== `wave-${this.wave}`);
		});
	}

	drawAdsr() {
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

	async updateLegend() {
		if (!navigator.keyboard?.getLayoutMap) {
			return;
		}

		const layoutMap = await navigator.keyboard.getLayoutMap();
		Object.keys(this.keys).forEach((note) => {
			const key = this.keys[note].key;
			const keyBtn = document.querySelector(`[data-note=${note}]`)!;
			const keyText = layoutMap.get(key);
			keyBtn.textContent = keyText;
		});
	}
}

new Synth();

window.onload = () => {
	"use strict";
	if ("serviceWorker" in navigator) {
		navigator.serviceWorker.register("./sw.js");
	}
};
