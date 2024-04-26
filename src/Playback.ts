import { RecNote } from "./signalRecorder";

export class Playback {
	notes: RecNote[];
	ctx: AudioContext;

	constructor(notes: RecNote[]) {
		this.notes = notes;
		this.ctx = new window.AudioContext();
	}

	public play() {
		this.notes.forEach((note) => {
			window.setTimeout(() => {
				console.log("on", note.key);
			}, note.start);

			window.setTimeout(() => {
				console.log("off", note.key);
			}, note.stop);
		});
	}
}
