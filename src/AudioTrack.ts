export class AudioTrack {
	id: number;
	src: string | null;
	ready: boolean;
	recordingsList: HTMLUListElement;
	template: HTMLTemplateElement;
	element: HTMLElement;
	audioEl: HTMLAudioElement;
	duration: number;
	mute: boolean;
	playButton: HTMLButtonElement;
	scrubInput: HTMLInputElement;
	currentTimeDisplay: HTMLSpanElement;
	vis: HTMLCanvasElement;
	indicator: HTMLDivElement;
	// enableBtn: HTMLButtonElement;
	loopBtn: HTMLButtonElement;
	inCtrl: HTMLInputElement;
	outCtrl: HTMLInputElement;
	wait: number;
	in: number;
	out: number;
	delBtn: HTMLButtonElement;
	saveBtn: HTMLButtonElement;

	constructor(id: number) {
		this.template = document.querySelector("#recordingTemplate") as HTMLTemplateElement;
		this.recordingsList = document.querySelector("#recordingsList") as HTMLUListElement;

		this.id = id;
		this.src = null;
		this.wait = 0;
		this.in = 0;
		this.out = 0;
		this.mute = false;

		this.createNewAudioElement();
		this.handleTimingControls();

		this.loop();

		this.delBtn.addEventListener("click", () => {
			this.delete();
		});

		this.saveBtn.addEventListener("click", () => {
			this.save();
		});
	}

	addSrc(src: string) {
		this.audioEl.src = src;
		this.audioEl.load();
		this.getDuration(this.audioEl.src, (d: number) => {
			this.duration = parseFloat(d.toFixed(3));
			this.outCtrl.value = this.duration.toString();
			this.out = this.duration;
			this.outCtrl.max = this.duration.toString();
			this.drawWaveform();
			this.element.setAttribute("data-ready", "true");
		});
	}

	getDuration(src: string, next: (duration) => void) {
		var player = new Audio(src);
		player.addEventListener(
			"durationchange",
			function () {
				if (this.duration != Infinity) {
					var duration = this.duration;
					player.remove();
					next(duration);
				}
			},
			false
		);
		player.load();
		player.currentTime = 24 * 60 * 60; //fake big time
		player.volume = 0;
		player.play();
		//waiting...
	}

	createNewAudioElement() {
		const content = this.template.content;
		const recordNode = content.firstElementChild!.cloneNode(true) as HTMLElement;
		this.recordingsList.appendChild(recordNode);

		this.element = recordNode;

		const audioEl = recordNode.querySelector("audio") as HTMLAudioElement;
		audioEl.id = `recording${this.id}`;
		this.audioEl = audioEl;

		// this.enableBtn = recordNode.querySelector('[data-audio-ctrl="enabled"]') as HTMLButtonElement;
		this.loopBtn = recordNode.querySelector('[data-audio-ctrl="loop"]') as HTMLButtonElement;
		this.inCtrl = recordNode.querySelector('[data-audio-ctrl="in"]') as HTMLInputElement;
		this.outCtrl = recordNode.querySelector('[data-audio-ctrl="out"]') as HTMLInputElement;
		this.delBtn = recordNode.querySelector('[data-audio-ctrl="del"]') as HTMLButtonElement;
		this.saveBtn = recordNode.querySelector('[data-audio-ctrl="save"]') as HTMLButtonElement;
		this.playButton = recordNode.querySelector(".audioPlay") as HTMLButtonElement;
		this.scrubInput = recordNode.querySelector(".audioScrub") as HTMLInputElement;
		this.currentTimeDisplay = recordNode.querySelector(".currentTime") as HTMLSpanElement;
		this.vis = recordNode.querySelector("canvas") as HTMLCanvasElement;
		this.indicator = recordNode.querySelector(".indicator") as HTMLDivElement;

		this.audioEl.loop = true;
		this.audioEl.preload = "auto";
	}

	handleTimingControls() {
		this.inCtrl.addEventListener("input", () => {
			this.setInpoint(parseFloat(this.inCtrl.value));
		});

		this.outCtrl.addEventListener("input", () => {
			this.setOutpoint(parseFloat(this.outCtrl.value));
		});

		// this.enableBtn.addEventListener("click", () => {
		// 	this.audioEl.muted = !this.audioEl.muted;
		// 	this.enableBtn.ariaPressed = (!this.audioEl.muted).toString();
		// });

		this.loopBtn.addEventListener("click", () => {
			this.audioEl.loop = !this.audioEl.loop;
			this.loopBtn.ariaPressed = this.audioEl.loop.toString();
		});

		// Event listeners
		this.playButton.addEventListener("click", () => this.togglePlay());
		this.scrubInput.addEventListener("input", () => this.scrubAudio());
		this.audioEl.addEventListener("play", () => {
			this.updateCurrentTime();
		});
		this.audioEl.addEventListener("pause", () => {
			this.playButton.ariaPressed = "false";
		});
		this.audioEl.addEventListener("seeking", () => {
			if (this.audioEl.paused) {
				return;
			}
			if (this.audioEl.currentTime > this.out) {
				this.audioEl.currentTime = this.out;
			}
			if (this.audioEl.currentTime < this.in) {
				this.audioEl.currentTime = this.in;
			}
		});
		this.updateCurrentTime();
	}

	setInpoint(time: number) {
		this.in = time;
		const cssPerc = `${(time / this.duration) * 100}%`;
		this.indicator.style.setProperty("--in-pos", cssPerc);
		if (this.inCtrl.value !== this.in.toFixed(3)) {
			this.inCtrl.value = this.in.toFixed(3);
		}
	}

	setOutpoint(time: number) {
		this.out = time;
		const cssPerc = `${(time / this.duration) * 100}%`;
		this.indicator.style.setProperty("--out-pos", cssPerc);
		if (this.outCtrl.value !== this.out.toFixed(3)) {
			this.outCtrl.value = this.out.toFixed(3);
		}
	}

	loop() {
		if (!this.audioEl.paused) {
			if (this.audioEl.currentTime <= this.in) {
				this.audioEl.currentTime = this.in;
			}
			if (this.audioEl.currentTime >= this.out) {
				this.audioEl.currentTime = this.in;
				if (!this.audioEl.loop) {
					this.audioEl.pause();
				}
			}
		}

		window.setTimeout(() => {
			this.loop();
		}, 0);
	}

	togglePlay(force?: boolean): void {
		const play = () => {
			this.audioEl.play();
			this.playButton.ariaPressed = "true";
		};

		const pause = () => {
			this.audioEl.pause();
			this.playButton.ariaPressed = "false";
		};

		if (force === true) {
			play();
		} else if (force === false) {
			pause();
		} else if (this.audioEl.paused) {
			play();
		} else {
			pause();
		}
	}

	private scrubAudio(): void {
		const scrubTime = (parseFloat(this.scrubInput.value) / 10000) * this.duration;
		this.audioEl.currentTime = scrubTime;
		this.updateCurrentTime();
	}

	private updateCurrentTime(): void {
		this.scrubInput.value = String((this.audioEl.currentTime / this.duration) * 10000);

		const inPerc = (this.in / this.duration) * 10000;
		const outPerc = (this.out / this.duration) * 10000;
		const value = Math.min(Math.max(parseFloat(this.scrubInput.value), inPerc), outPerc) / 100;
		this.indicator.style.setProperty("--play-pos", `${value || 0}%`);
		this.currentTimeDisplay.textContent = this.formatTime(this.audioEl.currentTime);

		window.requestAnimationFrame(() => {
			this.updateCurrentTime();
		});
	}

	private formatTime(seconds: number): string {
		const minutes = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		const millis = Math.floor((seconds % 1) * 1000);
		return `${minutes < 10 ? "0" : ""}${minutes}:${secs < 10 ? "0" : ""}${secs}:${
			millis < 10 ? "00" : millis < 100 ? "0" : ""
		}${millis}`;
	}

	async drawWaveform(): Promise<void> {
		const audioContext = new window.AudioContext();
		const canvasContext = this.vis.getContext("2d");

		if (!canvasContext) {
			console.error("Failed to get canvas context.");
			return;
		}

		const response = await fetch(this.audioEl.src);
		const arrayBuffer = await response.arrayBuffer();
		const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

		const channelData = audioBuffer.getChannelData(0); // Use the first channel (mono)
		const canvasWidth = this.vis.width;
		const canvasHeight = this.vis.height;

		// Calculate the step size to match the canvas width
		const step = Math.floor(channelData.length / canvasWidth);
		const amplitude = canvasHeight / 2;

		// Clear the canvas before drawing
		canvasContext.clearRect(0, 0, canvasWidth, canvasHeight);
		canvasContext.fillStyle = "rgba(0,0,0,0)"; // Background color
		canvasContext.fillRect(0, 0, canvasWidth, canvasHeight);
		canvasContext.strokeStyle = "#ffffff"; // Waveform color
		canvasContext.beginPath();
		canvasContext.moveTo(0, amplitude);

		for (let i = 0; i < canvasWidth; i++) {
			const slice = channelData.slice(i * step, (i + 1) * step);
			const min = Math.min(...slice);
			const max = Math.max(...slice);

			const yMin = amplitude + min * amplitude;
			const yMax = amplitude + max * amplitude;

			canvasContext.lineTo(i, yMin);
			canvasContext.lineTo(i, yMax);
		}

		canvasContext.stroke();
	}

	delete() {
		this.element.remove();
	}

	async trimAudio(): Promise<Blob> {
		// Fetch the blob from the audio URL
		const response = await fetch(this.audioEl.src);
		const audioBlob = await response.blob();

		// Create an audio context
		const audioContext = new AudioContext();
		const arrayBuffer = await audioBlob.arrayBuffer();

		// Decode the audio data
		const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

		// Calculate start and end points in seconds
		const startTime = this.in;
		const endTime = this.out;

		// Create a new audio buffer with the trimmed duration
		const trimmedDuration = endTime - startTime;
		const trimmedAudioBuffer = audioContext.createBuffer(
			audioBuffer.numberOfChannels,
			audioContext.sampleRate * trimmedDuration,
			audioContext.sampleRate
		);

		// Copy the audio data from the original buffer to the trimmed buffer
		for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
			const channelData = audioBuffer.getChannelData(i);
			const trimmedChannelData = trimmedAudioBuffer.getChannelData(i);
			trimmedChannelData.set(
				channelData.subarray(
					Math.floor(startTime * audioContext.sampleRate),
					Math.floor(endTime * audioContext.sampleRate)
				)
			);
		}

		// Create a MediaRecorder to encode the trimmed buffer to a Blob
		const destination = audioContext.createMediaStreamDestination();
		const source = audioContext.createBufferSource();
		source.buffer = trimmedAudioBuffer;
		source.connect(destination);
		source.start();

		return new Promise<Blob>((resolve) => {
			const recorder = new MediaRecorder(destination.stream);
			const chunks: BlobPart[] = [];

			recorder.ondataavailable = (event) => chunks.push(event.data);
			recorder.onstop = () => resolve(new Blob(chunks, { type: "audio/webm" }));

			recorder.start();
			source.onended = () => recorder.stop();
		});
	}

	async save() {
		this.saveBtn.setAttribute("aria-busy", "true");
		const blob = await this.trimAudio();
		// Create a URL for the blob
		const url = URL.createObjectURL(blob);

		// Create an anchor element to trigger the download
		const a = document.createElement("a");
		a.href = url;
		a.download = `JSSynth_Track_${this.id + 1}.webm`;
		document.body.appendChild(a);
		a.click();

		// Clean up by revoking the URL and removing the anchor element
		setTimeout(() => {
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			this.saveBtn.removeAttribute("aria-busy");
		}, 100);
	}
}
