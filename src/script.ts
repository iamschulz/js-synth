import { AudioRecorder } from "./audioRecorder";
import { Waveform } from "./waveform.ts";
import { MidiAdapter } from "./midi.ts";
import { getKeyName, getNote } from "./keys.ts";
import { ToneGenerator } from "./ToneGenerator.ts";

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
	distort: number;
	overdrive: number;
	pitch: number;
	pitchBend: number;
	activeNotes: string[];
	keyBtns: NodeListOf<HTMLButtonElement>;
	controls: HTMLFormElement;
	headerDiagram: SVGElement;
	MidiAdapter: MidiAdapter;
	midiIn: number;
	midiOut: number;
	AudioRecorder: AudioRecorder;
	toneGenerators: ToneGenerator[];

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
		this.distort = 0;
		this.overdrive = 0;
		this.pitch = 0;
		this.pitchBend = 0.5;
		this.activeNotes = [];
		this.keyBtns = document.querySelectorAll(".keyboard button");
		this.controls = document.querySelector("#header-controls")!;
		this.headerDiagram = document.querySelector("#header-vis")!;

		this.keyboardControls();
		this.buttonControls();
		this.optionControls();
		this.updateLegend();

		this.MidiAdapter = new MidiAdapter({
			playCallback: this.onMidiPlay.bind(this),
			releaseCallback: this.onMidiRelease.bind(this),
			pitchCallback: this.onMidiPitchBend.bind(this),
		});

		this.killDeadNodes();

		this.AudioRecorder = new AudioRecorder(this.ctx);
		this.toneGenerators = [new ToneGenerator(this.AudioRecorder, this.ctx)];
	}

	/**
	 * Called when a note starts playing
	 *
	 * @param {String} key
	 */
	playNote(key = "a", velocity = 1): void {
		if (this.activeNotes.includes(key)) {
			return; // note is already playing
		}

		this.toneGenerators.forEach((toneGenerator) => {
			toneGenerator.playNote(key, velocity, this.pitchBend);
		});

		Array.from(this.keyBtns)
			.filter((btn) => btn.dataset.note === key)[0]
			?.classList.add("active");

		this.activeNotes.push(key);

		this.MidiAdapter.onPlayNote(key, velocity);
	}

	/**
	 * Called when a note stops playing
	 *
	 * @param {Object} node
	 */
	endNote(key: string): void {
		this.toneGenerators.forEach((toneGenerator) => {
			toneGenerator.releaseNote(key);
		});

		Array.from(this.keyBtns)
			.filter((btn) => btn.dataset.note === key)[0]
			?.classList.remove("active");

		this.activeNotes = this.activeNotes.filter((note) => note !== key);

		this.MidiAdapter.onPlayNote(key, 0);
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

				// note is already playing
				if (this.activeNotes.includes(note)) {
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

			this.endNote(note);
		});
	}

	transpose(keyName: string, offset: number): string {
		const octave = parseInt(keyName.slice(-1));
		const note = keyName.slice(0, -1);
		return `${note}${octave + offset}`;
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
		let note = getNote(midiCode);

		if (!note) {
			return;
		}

		note = this.transpose(note, -4);

		// note is already playing
		if (this.activeNotes.includes(note)) return;

		this.playNote(note, velocity);
	}

	/**
	 * Calback for MIDI inputs for key releases.
	 *
	 * @param midiCode - Code of the key.
	 *
	 * @returns
	 */
	onMidiRelease(midiCode: number): void {
		let note = getNote(midiCode);

		if (!note) {
			return;
		}

		note = this.transpose(note, -4);
		this.endNote(note);
	}

	/**
	 * Callback for MIDI pitch bend inputs.
	 *
	 * @param offset - Pitch offset, between 0 and 1, 0.5 is no offset.
	 */
	onMidiPitchBend(offset: number): void {
		this.toneGenerators.forEach((toneGenerator) => {
			toneGenerator.pitchBend(offset);
		});
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
					if (!key || !this.activeNotes.includes(key)) return;

					this.endNote(key);
				},
				{ passive: true }
			);

			btn.addEventListener(
				"mouseout",
				(e) => {
					const key = btn.dataset.note;
					if (!key || !this.activeNotes.includes(key)) return;

					this.endNote(key);
				},
				{ passive: true }
			);

			btn.addEventListener(
				"touchend",
				(e) => {
					const key = btn.dataset.note;
					if (!key || !this.activeNotes.includes(key)) return;

					this.endNote(key);
				},
				{ passive: true }
			);

			btn.addEventListener(
				"touchcancel",
				(e) => {
					const key = btn.dataset.note;
					if (!key || !this.activeNotes.includes(key)) return;

					this.endNote(key);
				},
				{ passive: true }
			);

			btn.addEventListener("keyup", (e) => {
				const key = btn.dataset.note;
				if (!(e.code === "Space" || e.key === "Enter")) return;
				if (!key || !this.activeNotes.includes(key)) return;

				this.endNote(key);
			});

			btn.addEventListener("blur", () => {
				const key = btn.dataset.note;
				if (!key || !this.activeNotes.includes(key)) return;

				this.endNote(key);
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
			this.distort = parseFloat(data.distort || 0);
			this.overdrive = parseFloat(data.overdrive || 0);
			this.pitch = parseInt(data.pitch || 3);
			//this.midiIn = parseInt(data.midiIn) || 0;
			//this.midiOut = parseInt(data.midiOut) || 0;
			this.drawWave();
			this.drawAdsr();

			localStorage.synthConfig = JSON.stringify({
				wave: this.wave,
				volume: this.volume,
				attack: this.attack,
				decay: this.decay,
				sustain: this.sustain,
				release: this.release,
				distort: this.distort,
				overdrive: this.overdrive,
				pitch: this.pitch,
				//midiIn: this.midiIn,
				//midiOut: this.midiOut,
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
				const waveformEl = this.controls.querySelector(`#${conf}`) as HTMLInputElement | undefined;
				if (!waveformEl) return;
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
		if (this.MidiAdapter.activeNotes === 0 && !document.querySelector("button.active")) {
			Object.keys(this.activeNotes).forEach((note) => {
				this.endNote(note);
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
