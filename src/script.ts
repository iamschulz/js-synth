import { AudioRecorder } from "./audioRecorder";
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
	pitchBend: number;
	activeNotes: string[];
	keyBtns: NodeListOf<HTMLButtonElement>;
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
		this.headerDiagram = document.querySelector("#header-vis")!;

		this.AudioRecorder = new AudioRecorder(this.ctx);
		this.toneGenerators = [new ToneGenerator(0, this.AudioRecorder, this.ctx, this.headerDiagram)];

		this.pitchBend = 0.5;
		this.activeNotes = [];
		this.keyBtns = document.querySelectorAll(".keyboard button");

		this.keyboardControls();
		this.buttonControls();
		this.updateLegend();

		this.MidiAdapter = new MidiAdapter({
			playCallback: this.onMidiPlay.bind(this),
			releaseCallback: this.onMidiRelease.bind(this),
			pitchCallback: this.onMidiPitchBend.bind(this),
		});

		this.killDeadNodes();
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
