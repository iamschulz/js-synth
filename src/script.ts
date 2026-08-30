import { AudioRecorder } from "./audioRecorder";
import { MidiAdapter } from "./midi.ts";
import { getKeyName, getNote, midiOctaveOffset } from "./keys.ts";
import { ToneGenerator } from "./ToneGenerator.ts";
import { Slider } from "./Slider.ts";
import { listSynthSettings, saveSynthSettings, synthSettingsName } from "./settingsStore.ts";
import { loadSample, saveSample } from "./sampleStore.ts";
import {
	parsePreset,
	PresetSynth,
	sampleFromPreset,
	sampleToPreset,
	serializePreset,
	settingsFromPreset,
	settingsToPreset,
} from "./presetFile.ts";

/* scroll distance needed for a full pitch bend in either direction */
const PITCH_WHEEL_RANGE = 400;

/* set on the document while a held note turns the wheel into a pitch wheel */
const SCROLL_LOCK_CLASS = "pitch-wheel-armed";

/* rough pixel equivalents for browsers that report scrolling in lines or pages */
const LINE_HEIGHT = 16;
const PAGE_HEIGHT = 400;

/**
 * Normalizes a wheel event to pixels, whichever unit the browser reports in.
 */
const scrollDistance = (e: WheelEvent): number => {
	if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
		return e.deltaY * LINE_HEIGHT;
	}

	if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
		return e.deltaY * PAGE_HEIGHT;
	}

	return e.deltaY;
};

/**
 * Puts a message in front of the user, in the same modal the app uses elsewhere.
 * The dialog is thrown away once it closes.
 */
const showMessage = (message: string): void => {
	const dialog = document.createElement("dialog");
	const text = document.createElement("p");
	text.textContent = message;

	const buttons = document.createElement("div");
	buttons.className = "buttons";

	const closeBtn = document.createElement("button");
	closeBtn.className = "close";
	closeBtn.textContent = "Close";
	closeBtn.addEventListener("click", () => dialog.close());

	buttons.appendChild(closeBtn);
	dialog.append(text, buttons);
	dialog.addEventListener("close", () => dialog.remove());

	document.body.appendChild(dialog);
	dialog.showModal();
};

export class Main {
	ctx: AudioContext;
	keys: {
		[key: string]: {
			key: string;
			midiIn: number;
		};
	};
	pitchBend: number;
	pitchWheelDelta: number;
	activeNotes: string[];
	pressedKeys: Set<string>;
	keyBtns: NodeListOf<HTMLButtonElement>;
	headerDiagram: SVGElement;
	MidiAdapter: MidiAdapter;
	midiIn: number;
	midiOut: number;
	AudioRecorder: AudioRecorder;
	toneGenerators: ToneGenerator[];
	addBtn: HTMLButtonElement;
	removeBtn: HTMLButtonElement;
	saveBtn: HTMLButtonElement;
	loadBtn: HTMLButtonElement;
	loadInput: HTMLInputElement;
	slider: Slider;
	sustain: boolean;
	ready: Promise<void>; // resolves once the synths of an earlier session are back

	constructor() {
		if (!window.AudioContext) {
			(document.querySelector(".error") as HTMLDialogElement).showModal();
			return;
		}

		this.ctx = new window.AudioContext();
		this.headerDiagram = document.querySelector("#header-vis")!;

		this.AudioRecorder = new AudioRecorder(this.ctx);
		this.toneGenerators = [];

		this.pitchBend = 0.5;
		this.pitchWheelDelta = 0;
		this.sustain = false;
		this.activeNotes = [];
		this.pressedKeys = new Set();
		this.keyBtns = document.querySelectorAll(".keyboard button");

		this.addBtn = document.querySelector("#add-synth") as HTMLButtonElement;
		this.addBtn.addEventListener("click", () => {
			this.addSynth();
		});

		this.removeBtn = document.querySelector("#remove-synth") as HTMLButtonElement;
		this.removeBtn.disabled = true; // nothing to remove until the stored synths are back
		this.removeBtn.addEventListener("click", () => {
			this.removeSynth();
		});

		this.saveBtn = document.querySelector("#save-config") as HTMLButtonElement;
		this.loadBtn = document.querySelector("#load-config") as HTMLButtonElement;
		this.loadInput = document.querySelector("#load-config-file") as HTMLInputElement;
		this.configControls();

		this.keyboardControls();
		this.buttonControls();
		this.pitchWheelControls();
		this.updateLegend();

		this.MidiAdapter = new MidiAdapter({
			playCallback: this.onMidiPlay.bind(this),
			releaseCallback: this.onMidiRelease.bind(this),
			pitchCallback: this.onMidiPitchBend.bind(this),
			sustainCallback: this.onMidiSustain.bind(this),
		});

		this.killDeadNodes();

		this.ready = this.restoreSynths();
	}

	activeToneGenerator(): ToneGenerator | undefined {
		const id = this.slider?.activeItem?.id.split("-")[2];
		return this.toneGenerators.find((tg) => tg.id === id) || this.toneGenerators[0];
	}

	/**
	 * Brings back the synths of the last session. The slider follows them, it
	 * measures the controls once they are in the DOM.
	 */
	private async restoreSynths(): Promise<void> {
		this.toneGenerators = await this.loadSavedToneGenerators();
		this.toneGenerators[0].drawAdsr();

		this.slider = new Slider((el: HTMLElement) => {
			const id = el.id.split("-")[2];
			const activeToneGenerator = this.toneGenerators.find((tg) => tg.id === id);
			activeToneGenerator?.drawAdsr();
		});

		if (this.toneGenerators.length > 1) {
			this.removeBtn.disabled = false; // enable remove button once a second synth is around
		}

		await Promise.all(this.toneGenerators.map((tg) => tg.ready));
		this.activeToneGenerator()?.drawAdsr();
	}

	async loadSavedToneGenerators(): Promise<ToneGenerator[]> {
		let stored: string[] = [];

		try {
			stored = await listSynthSettings();
		} catch (e) {
			console.error("Could not read the stored synths.", e);
		}

		const toneGenerators = stored.map(
			(name) => new ToneGenerator(name.split("-")[2], this.AudioRecorder, this.ctx, this.headerDiagram)
		);

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
		this.slider?.animateScrollSliderToTarget(toneGenerator.controls.el);

		this.removeBtn.disabled = false; // enble remove button when a second synth is added
	}

	removeSynth(): void {
		if (this.toneGenerators.length <= 1) {
			return; // cannot remove the last synth
		}

		const activeElement = this.slider?.activeItem;
		const synthId = activeElement?.id.split("-")[2];
		const activeToneGenerator = this.toneGenerators.find((tg) => tg.id === synthId);
		if (!activeToneGenerator) {
			return; // no active tone generator to remove
		}

		const scrollTarget = (activeToneGenerator.controls.el.nextSibling ||
			activeToneGenerator.controls.el.previousSibling) as HTMLElement;
		this.slider?.animateScrollSliderToTarget(scrollTarget);
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

	configControls(): void {
		this.saveBtn.addEventListener("click", () => {
			this.saveConfig();
		});

		/* the file input is hidden, the styled button stands in for it */
		this.loadBtn.addEventListener("click", () => {
			this.loadInput.click();
		});

		this.loadInput.addEventListener("change", () => {
			const file = this.loadInput.files?.[0];
			this.loadInput.value = ""; // so picking the same file again fires another change

			if (file) {
				this.loadConfig(file);
			}
		});
	}

	async saveConfig(): Promise<void> {
		this.saveBtn.disabled = true;

		try {
			await this.ready; // an export before the stored synths are back would be empty

			const synths: PresetSynth[] = await Promise.all(
				this.toneGenerators.map(async (tg) => {
					const stored = await loadSample(tg.id);

					return {
						settings: settingsToPreset(tg.controls.readData(), tg.id),
						sample: stored ? await sampleToPreset(stored) : null,
					};
				})
			);

			const url = URL.createObjectURL(new Blob([serializePreset(synths)], { type: "application/json" }));
			const link = document.createElement("a");
			link.href = url;
			link.download = `jssynth-preset-${new Date().toISOString().slice(0, 10)}.json`;
			link.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			console.error("Could not save the configuration.", e);
			showMessage("The configuration could not be saved.");
		} finally {
			this.saveBtn.disabled = false;
		}
	}

	async loadConfig(file: File): Promise<void> {
		this.loadBtn.disabled = true;

		try {
			const synths = parsePreset(await file.text());
			await this.replaceSynths(synths);
		} catch (e) {
			console.error("Could not load the configuration.", e);
			showMessage(e instanceof Error ? e.message : "The configuration could not be loaded.");
		} finally {
			this.loadBtn.disabled = false;
		}
	}

	private async replaceSynths(synths: PresetSynth[]): Promise<void> {
		await this.ready; // the restore of the last session would otherwise land on top

		this.activeNotes.slice().forEach((key) => this.endNote(key, true));
		this.toneGenerators.forEach((tg) => tg.destroy()); // also drops their stored settings and samples
		this.toneGenerators = [];

		const base = Date.now();

		for (const [i, synth] of synths.entries()) {
			const id = (base + i).toString(); // ordered ids, so a reload brings them back in order

			await saveSynthSettings(synthSettingsName(id), settingsFromPreset(synth.settings, id));

			if (synth.sample) {
				await saveSample(id, sampleFromPreset(synth.sample));
			}

			this.toneGenerators.push(new ToneGenerator(id, this.AudioRecorder, this.ctx, this.headerDiagram));
		}

		this.removeBtn.disabled = this.toneGenerators.length <= 1;

		this.slider.el.scrollLeft = 0;
		this.slider.activeItem = this.toneGenerators[0].controls.el;
		this.slider.updateButtons();

		await Promise.all(this.toneGenerators.map((tg) => tg.ready));
		this.activeToneGenerator()?.drawAdsr();
	}

	/**
	 * Called when a note starts playing
	 *
	 * @param {String} key
	 */
	playNote(key = "a", velocity = 1): void {
		if (this.sustain && this.pressedKeys.has(key)) {
			this.endNote(key, true);
		}
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
	endNote(key: string, force = false): void {
		if (this.sustain && !force) {
			return;
		}

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
			if (e.repeat) {
				return;
			}
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

				this.pressedKeys.add(note);
				this.lockScroll(true); // the wheel bends the pitch from here on
				this.playNote(note);
			}
		});

		document.addEventListener("keyup", (e) => {
			const note = getNote(e.code);

			if (!note) {
				return;
			}
			this.pressedKeys.delete(note);

			this.endNote(note);
			this.releasePitchWheel(); // after the note is gone, so its release tail keeps the bend
		});
	}

	pitchWheelControls(): void {
		document.addEventListener(
			"wheel",
			(e) => {
				if (this.pressedKeys.size === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
					return; // no held note, or a sideways scroll meant for the synth slider
				}

				e.preventDefault(); // the gesture bends the pitch instead of scrolling the page
				this.lockScroll(true); // ...and preventDefault() is ignored on a latched gesture

				this.pitchWheelDelta = Math.min(
					Math.max(this.pitchWheelDelta - scrollDistance(e), -PITCH_WHEEL_RANGE),
					PITCH_WHEEL_RANGE
				);

				this.setPitchBend(0.5 + this.pitchWheelDelta / (2 * PITCH_WHEEL_RANGE));
			},
			{ passive: false } // wheel listeners on the document are passive by default
		);

		/* a keyup can go missing while the tab is away, so never leave the page frozen */
		window.addEventListener("blur", () => this.lockScroll(false));
	}

	releasePitchWheel(): void {
		if (this.pressedKeys.size > 0) {
			return;
		}

		this.lockScroll(false);

		if (this.pitchWheelDelta === 0) {
			return;
		}

		this.pitchWheelDelta = 0;
		this.setPitchBend(0.5);
	}

	/**
	 * Freezes the page while the pitch wheel is armed. Preventing the wheel event
	 * isn't enough on its own: browsers mark wheel events non-cancelable once a
	 * scroll gesture is already rolling, so a note started mid-scroll (or the
	 * momentum tail of a trackpad flick) would still scroll the page away.
	 *
	 * @param locked - Whether scrolling should be blocked.
	 */
	lockScroll(locked: boolean): void {
		const root = document.documentElement;

		if (locked === root.classList.contains(SCROLL_LOCK_CLASS)) {
			return;
		}

		if (locked) {
			/* measure before locking, so the layout doesn't jump when the scrollbar goes */
			root.style.setProperty("--scrollbar-width", `${window.innerWidth - root.clientWidth}px`);
		}

		root.classList.toggle(SCROLL_LOCK_CLASS, locked);
	}
	
	setPitchBend(offset: number): void {
		this.pitchBend = offset;
		this.toneGenerators.forEach((toneGenerator) => {
			toneGenerator.pitchBend(offset);
		});
	}

	transpose(keyName: string, offset: number): string {
		const match = keyName.match(/^(.*?)(-?\d+)$/);
		if (!match) {
			return keyName;
		}
		const [, note, octaveStr] = match;
		return `${note}${parseInt(octaveStr, 10) + offset}`;
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

		note = this.transpose(note, -midiOctaveOffset);

		if (this.sustain && this.pressedKeys.has(note)) {
			this.endNote(note, true);
		}

		this.pressedKeys.add(note);
		this.lockScroll(true); // the wheel bends the pitch from here on
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

		note = this.transpose(note, -midiOctaveOffset);
		this.pressedKeys.delete(note);
		this.endNote(note);
		this.releasePitchWheel(); // after the note is gone, so its release tail keeps the bend
	}

	/**
	 * Callback for MIDI pitch bend inputs.
	 *
	 * @param offset - Pitch offset, between 0 and 1, 0.5 is no offset.
	 */
	onMidiPitchBend(offset: number): void {
		/* keep the mouse wheel in sync, so it picks up where the hardware wheel left off */
		this.pitchWheelDelta = (offset - 0.5) * 2 * PITCH_WHEEL_RANGE;
		this.setPitchBend(offset);
	}

	onMidiSustain(toggle: number): void {
		this.sustain = !!toggle;
		if (!this.sustain) {
			this.onSustainEnd();
		}
	}

	onSustainEnd(): void {
		this.activeNotes.forEach((key) => {
			if (!this.pressedKeys.has(key)) {
				this.endNote(key);
			}
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
			btn.addEventListener("keypress", (e) => {
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
