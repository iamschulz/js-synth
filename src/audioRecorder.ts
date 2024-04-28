import { AudioTrack } from "./AudioTrack";

export class AudioRecorder {
	ctx: AudioContext;
	recorder: MediaRecorder | null;
	recordingStream: MediaStreamAudioDestinationNode | null;
	recordingsList: HTMLUListElement;
	recordings: AudioTrack[];
	recordingTemplate: HTMLTemplateElement;
	recBtn: HTMLButtonElement;
	playBtn: HTMLButtonElement;

	constructor(ctx: AudioContext) {
		this.ctx = ctx;

		this.recordingTemplate = document.querySelector("#recordingTemplate") as HTMLTemplateElement;
		this.recordingsList = document.querySelector("#recordingsList") as HTMLUListElement;
		this.recBtn = document.querySelector("#rec") as HTMLButtonElement;
		this.playBtn = document.querySelector("#play") as HTMLButtonElement;

		this.recordings = [];
		this.recorder = null;
		this.recordingStream = null;

		this.recBtn.addEventListener("click", () => {
			const active = this.recBtn.ariaPressed === "true";
			if (active) {
				this.stopRecording();
			} else {
				this.startRecording();
			}
			this.recBtn.ariaPressed = (!active).toString();
		});

		this.playBtn.addEventListener("click", () => {
			const playing = this.recordings.every((rec) => rec.audioEl.paused === false);

			this.recordings.forEach((rec) => {
				if (playing) {
					rec.audioEl.pause();
					rec.audioEl.currentTime = 0;
				} else {
					rec.audioEl.currentTime = 0;
					rec.audioEl.play();
				}
			});

			this.playBtn.ariaPressed = (!playing).toString();
		});
	}

	startRecording() {
		const audioTrack = new AudioTrack(this.recordings.length);
		this.recordings.push(audioTrack);

		this.recorder?.stop();
		this.recordingStream = this.ctx.createMediaStreamDestination();
		this.recorder = new MediaRecorder(this.recordingStream.stream);
		this.recorder.start();
	}

	stopRecording() {
		this.recorder?.addEventListener("dataavailable", (e) => {
			this.recordings.at(-1)?.addSrc(URL.createObjectURL(e.data));
			this.recorder = null;
			this.recordingStream = null;
		});
		this.recorder?.stop();
	}
}
