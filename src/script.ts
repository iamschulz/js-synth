import { AudioRecorder } from "./audioRecorder";
import { MidiAdapter } from "./midi.ts";
import { getKeyName, getNote } from "./keys.ts";
import { ToneGenerator } from "./ToneGenerator.ts";
import { Slider } from "./Slider.ts";

export class Main {
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
	slider: Slider;

	constructor() {
		if (!window.AudioContext) {
			(document.querySelector(".error") as HTMLDialogElement).showModal();
			return;
		}

		this.ctx = new window.AudioContext();
		this.headerDiagram = document.querySelector("#header-vis")!;

		this.AudioRecorder = new AudioRecorder(this.ctx);
		this.toneGenerators = this.loadSavedToneGenerators();
		this.toneGenerators[0].drawAdsr();

		this.slider = new Slider((el: HTMLElement) => {
			const id = el.id.split("-")[2];
			const activeToneGenerator = this.toneGenerators.find((tg) => tg.id === id);
			activeToneGenerator?.drawAdsr();
		});

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

		if (this.toneGenerators.length === 1) {
			this.removeBtn.disabled = true; // disable remove button if only one synth is left
		}

		this.MidiAdapter = new MidiAdapter({
			playCallback: this.onMidiPlay.bind(this),
			releaseCallback: this.onMidiRelease.bind(this),
			pitchCallback: this.onMidiPitchBend.bind(this),
		});

		this.killDeadNodes();
	}

	loadSavedToneGenerators(): ToneGenerator[] {
		const items = { ...localStorage };
		const toneGenerators = Object.keys(items)
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

		if (toneGenerators.length === 0) {
			const tg = new ToneGenerator(Date.now().toString(), this.AudioRecorder, this.ctx, this.headerDiagram);
			toneGenerators.push(tg);
		}

		return toneGenerators;
	}

	addSynth(): void {
		const toneGenerator = new ToneGenerator(
			Date.now().toString(),
			this.AudioRecorder,
			this.ctx,
			this.headerDiagram
		);
		this.toneGenerators.push(toneGenerator);
		this.slider.animateScrollSliderToTarget(toneGenerator.controls.el);

		this.removeBtn.disabled = false; // enble remove button when a second synth is added
	}

	removeSynth(): void {
		if (this.toneGenerators.length <= 1) {
			return; // cannot remove the last synth
		}

		const activeElement = this.slider.activeItem;
		const synthId = activeElement?.id.split("-")[2];
		const activeToneGenerator = this.toneGenerators.find((tg) => tg.id === synthId);
		if (!activeToneGenerator) {
			return; // no active tone generator to remove
		}

		const scrollTarget = (activeToneGenerator.controls.el.nextSibling ||
			activeToneGenerator.controls.el.previousSibling) as HTMLElement;
		this.slider.animateScrollSliderToTarget(scrollTarget);
		activeToneGenerator.controls.el.style.opacity = "0";

		window.setTimeout(() => {
			const scrollLeft = this.slider.el.scrollLeft - scrollTarget.clientWidth;
			activeToneGenerator.destroy();
			this.toneGenerators = this.toneGenerators.filter((tg) => tg.id !== activeToneGenerator.id);
			this.slider.el.scrollLeft = scrollLeft; // prevent scroll jump in safari

			if (this.toneGenerators.length === 1) {
				this.removeBtn.disabled = true; // disable remove button if only one synth is left
			}
			this.slider.updateButtons();
		}, 520);
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

		this.MidiAdapter?.onPlayNote(key, velocity);
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

		this.MidiAdapter?.onPlayNote(key, 0);
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

	killDeadNodes(): void {
		if (this.MidiAdapter?.activeNotes === 0 && !document.querySelector("button.active")) {
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

const swListener = new BroadcastChannel("chan");
swListener.onmessage = (e) => {
	if (e.data && e.data.type === "update") {
		if (e.data) {
			const dialog = document.createElement("dialog");
			dialog.innerHTML = `
				<p>
					Update available!<br>
					Please refresh to load version ${e.data.version}.
				</p>
				<div class="buttons">
					<button class="refresh">Refresh</button>
					<button class="close">Close</button>
				</div>
			`;
			document.body.appendChild(dialog);
			dialog.addEventListener("close", () => {
				document.body.removeChild(dialog);
			});
			const refreshBtn = dialog.querySelector(".refresh") as HTMLButtonElement;
			refreshBtn.addEventListener("click", () => {
				window.location.reload();
			});

			const closeBtn = dialog.querySelector(".close") as HTMLButtonElement;
			closeBtn?.addEventListener("click", () => {
				dialog.close();
			});

			dialog.showModal();
		}
	}
};

document.querySelectorAll("dialog").forEach((el) => {
	const closeBtn = el.querySelector(".close") as HTMLButtonElement | null;
	closeBtn?.addEventListener("click", () => {
		el.close();
	});
});

// start synth
window.Main = new Main();

// register sw
window.onload = async () => {
	"use strict";

	if ("serviceWorker" in navigator) {
		await navigator.serviceWorker.register("./sw.js");
	}
};
