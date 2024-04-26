import { Playback } from "./Playback";
import { Waveform } from "./waveform";

export type RecNote = {
	key: string;
	velocity: number;
	waveform: Waveform;
	attack: number;
	sustain: number;
	decay: number;
	release: number;
	start: number;
	stop: number;
};

export type Recording = {
	start: number;
	stop: number;
	playback: Playback;
};

export class SignalRecorder {
	isRecording: number; // start timestamp
	notes: RecNote[];
	recordings: Recording[];
	startBtn: HTMLButtonElement;
	stopBtn: HTMLButtonElement;
	playBtn: HTMLButtonElement;

	constructor() {
		this.isRecording = 0;
		this.notes = [];
		this.recordings = [];
		this.startBtn = document.querySelector("#startRec") as HTMLButtonElement;
		this.stopBtn = document.querySelector("#stopRec") as HTMLButtonElement;
		this.playBtn = document.querySelector("#playRec") as HTMLButtonElement;

		this.startBtn.addEventListener("click", () => {
			this.startRecording();
		});
		this.stopBtn.addEventListener("click", () => {
			this.stopRecording();
		});
		this.playBtn.addEventListener("click", () => {
			this.playRecording(0);
		});
	}

	startRecording() {
		this.isRecording = performance.now();
		this.startBtn.setAttribute("disabled", "disabled");
		this.stopBtn.removeAttribute("disabled");
	}

	public recordStartNote(note: RecNote) {
		if (!this.isRecording) {
			return;
		}
		note.start = note.start - this.isRecording;
		this.notes.push(note);
	}

	public recordStopNote(key: string) {
		const note = this.notes.sort((a, b) => b.start - a.start).find((note) => (note.key = key));

		if (!note) {
			return;
		}

		note.stop = performance.now() - this.isRecording;
	}

	stopRecording() {
		this.recordings.push({
			start: this.isRecording,
			stop: performance.now(),
			playback: new Playback(this.notes),
		});

		this.isRecording = 0;
		this.notes = [];

		this.startBtn.removeAttribute("disabled");
		this.stopBtn.setAttribute("disabled", "disabled");

		// todo: persist notes
	}

	playRecording(i: number) {
		this.recordings[i].playback.play();
	}
}
