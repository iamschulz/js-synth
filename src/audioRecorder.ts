import { AudioTrack } from "./AudioTrack";

export class AudioRecorder {
	ctx: AudioContext;
	recorder: MediaRecorder | null;
	recordingStream: MediaStreamAudioDestinationNode | null;
	recordingsList: HTMLUListElement;
	recordings: AudioTrack[];
	recordingTemplate: HTMLTemplateElement;
	startBtn: HTMLButtonElement;
	stopBtn: HTMLButtonElement;

	constructor(ctx: AudioContext) {
		this.ctx = ctx;

		this.recordingTemplate = document.querySelector("#recordingTemplate") as HTMLTemplateElement;
		this.recordingsList = document.querySelector("#recordingsList") as HTMLUListElement;
		this.startBtn = document.querySelector("#startRec") as HTMLButtonElement;
		this.stopBtn = document.querySelector("#stopRec") as HTMLButtonElement;

		this.recordings = [];
		this.recorder = null;
		this.recordingStream = null;

		this.startBtn.addEventListener("click", () => {
			this.startRecording();
		});
		this.stopBtn.addEventListener("click", () => {
			this.stopRecording();
		});
	}

	public startRecording() {
		const audioTrack = new AudioTrack(this.recordings.length);
		this.recordings.push(audioTrack);

		this.recorder?.stop();
		this.recordingStream = this.ctx.createMediaStreamDestination();
		this.recorder = new MediaRecorder(this.recordingStream.stream);
		this.recorder.start();
	}

	public stopRecording() {
		this.recorder!.addEventListener("dataavailable", (e) => {
			this.recordings.at(-1)?.addSrc(URL.createObjectURL(e.data));
			this.recorder = null;
			this.recordingStream = null;
		});
		this.recorder!.stop();
	}
}
