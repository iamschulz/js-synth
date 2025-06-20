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
	addBtn: HTMLButtonElement;
	removeBtn: HTMLButtonElement;
	sliderEl: HTMLDivElement;

	constructor() {
		if (!window.AudioContext) {
			(document.querySelector("dialog") as HTMLDialogElement).setAttribute("open", "open");
			return;
		}

		this.ctx = new window.AudioContext();
		this.headerDiagram = document.querySelector("#header-vis")!;
		this.sliderEl = document.querySelector(".controls-slider")!;
		this.sliderEl.addEventListener("scroll", this.onSliderChange.bind(this));

		this.AudioRecorder = new AudioRecorder(this.ctx);
		this.toneGenerators = this.loadSavedToneGenerators();
		this.toneGenerators[0].drawAdsr();

		this.pitchBend = 0.5;
		this.activeNotes = [];
		this.keyBtns = document.querySelectorAll(".keyboard button");

		this.addBtn = document.querySelector("#add-synth") as HTMLButtonElement;
		this.addBtn.addEventListener("click", () => {
			this.addSynth();
		});

		this.removeBtn = document.querySelector("#remove-synth") as HTMLButtonElement;
		this.removeBtn.addEventListener("click", () => {
			this.removeSynth();
		});

		this.keyboardControls();
		this.buttonControls();
		this.updateLegend();
		this.restoreSliderPosition();

		this.MidiAdapter = new MidiAdapter({
			playCallback: this.onMidiPlay.bind(this),
			releaseCallback: this.onMidiRelease.bind(this),
			pitchCallback: this.onMidiPitchBend.bind(this),
		});

		this.killDeadNodes();
	}

	loadSavedToneGenerators(): ToneGenerator[] {
		const items = { ...localStorage };
		const ToneGenerators = Object.keys(items)
			.filter((key) => key.startsWith("synth-controls-"))
			.sort((a, b) => {
				const aId = parseInt(a.split("-")[2]);
				const bId = parseInt(b.split("-")[2]);
				return aId - bId;
			})
			.map((key) => {
				const id = key.split("-")[2];
				return new ToneGenerator(id, this.AudioRecorder, this.ctx, this.headerDiagram);
			});

		if (ToneGenerators.length === 0) {
			ToneGenerators.push(
				new ToneGenerator(Date.now().toString(), this.AudioRecorder, this.ctx, this.headerDiagram)
			);
		}

		return ToneGenerators;
	}

	addSynth(): void {
		const toneGenerator = new ToneGenerator(
			Date.now().toString(),
			this.AudioRecorder,
			this.ctx,
			this.headerDiagram
		);
		toneGenerator.controls.el.classList.add("slide-in");
		this.toneGenerators.push(toneGenerator);
		this.sliderEl.scrollTo({
			left: this.sliderEl.scrollWidth,
			behavior: "smooth", // todo: this leads to a jump in safari
		});
	}

	removeSynth(): void {
		if (this.toneGenerators.length <= 1) {
			return; // cannot remove the last synth
		}

		const activeSynth = Array.from(document.querySelectorAll(".controls-slider .synth-controls")).find((el) => {
			const rect = (el as HTMLElement).getBoundingClientRect();
			return rect.left >= 0 && rect.right <= window.innerWidth;
		}) as HTMLFormElement;
		if (!activeSynth) {
			return; // no active synth to remove
		}
		const synthId = activeSynth.id.split("-")[2];
		const activeToneGenerator = this.toneGenerators.find((tg) => tg.id === synthId);
		if (!activeToneGenerator) {
			return; // no active tone generator to remove
		}

		// todo: this only works reliably in chrome
		const scrollTarget = (activeToneGenerator.controls.el.nextSibling ||
			activeToneGenerator.controls.el.previousSibling) as HTMLElement;
		this.sliderEl.scrollTo({
			left: scrollTarget.offsetLeft + 1,
			behavior: "smooth",
		});
		activeToneGenerator.controls.el.style.opacity = "0";

		window.setTimeout(() => {
			activeToneGenerator.destroy();
			this.toneGenerators = this.toneGenerators.filter((tg) => tg.id !== synthId);
		}, 700);
	}

	onSliderChange(): void {
		localStorage.setItem("slider-position", this.sliderEl.scrollLeft.toString());

		const activeSynth = Array.from(document.querySelectorAll(".controls-slider .synth-controls")).find((el) => {
			const rect = (el as HTMLElement).getBoundingClientRect();
			return rect.left >= 0 && rect.right <= window.innerWidth;
		}) as HTMLFormElement;

		if (!activeSynth) {
			return; // no active synth to update
		}

		const synthId = activeSynth.id.split("-")[2];
		const activeToneGenerator = this.toneGenerators.find((tg) => tg.id === synthId);
		if (!activeToneGenerator) {
			return; // no active tone generator to update
		}

		activeToneGenerator.drawAdsr();
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
		this.pitchBend = offset;
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

	restoreSliderPosition(): void {
		this.sliderEl.scrollLeft = parseInt(localStorage.getItem("slider-position") || "0");
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
		//navigator.serviceWorker.register("./sw.js");
	}
};
