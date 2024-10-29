export class AudioTrack {
	id: number;
	src: string | null;
	ready: boolean;
	recordingsList: HTMLUListElement;
	template: HTMLTemplateElement;
	element: HTMLElement;
	audioEl: HTMLAudioElement;
	duration: number;
	playButton: HTMLButtonElement;
	scrubInput: HTMLInputElement;
	currentTimeDisplay: HTMLSpanElement;
	vis: HTMLCanvasElement;
	indicator: HTMLDivElement;
	loopBtn: HTMLButtonElement;
	inCtrl: HTMLInputElement;
	outCtrl: HTMLInputElement;
	wait: number;
	in: number;
	out: number;
	delBtn: HTMLButtonElement;

	constructor(id: number) {
		this.template = document.querySelector("#recordingTemplate") as HTMLTemplateElement;
		this.recordingsList = document.querySelector("#recordingsList") as HTMLUListElement;

		this.id = id;
		this.src = null;
		this.wait = 0;
		this.in = 0;
		this.out = 0;

		this.createNewAudioElement();
		this.handleTimingControls();

		this.loop();

		this.delBtn.addEventListener("click", () => {
			this.delete();
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

		this.loopBtn = recordNode.querySelector('[data-audio-ctrl="loop"]') as HTMLButtonElement;
		this.inCtrl = recordNode.querySelector('[data-audio-ctrl="in"]') as HTMLInputElement;
		this.outCtrl = recordNode.querySelector('[data-audio-ctrl="out"]') as HTMLInputElement;
		this.delBtn = recordNode.querySelector('[data-audio-ctrl="del"]') as HTMLButtonElement;
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
			this.in = parseFloat(this.inCtrl.value);
			const cssPerc = `${(parseFloat(this.inCtrl.value) / this.duration) * 100}%`;
			console.log("in", cssPerc);
			this.indicator.style.setProperty("--in-pos", cssPerc);
		});

		this.outCtrl.addEventListener("input", () => {
			this.out = parseFloat(this.outCtrl.value);
			const cssPerc = `${(parseFloat(this.outCtrl.value) / this.duration) * 100}%`;
			this.indicator.style.setProperty("--out-pos", cssPerc);
		});

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
		this.audioEl.addEventListener("seeking", () => {
			if (this.audioEl.currentTime > this.out) {
				this.audioEl.currentTime = this.out;
			}
			if (this.audioEl.currentTime < this.in) {
				this.audioEl.currentTime = this.in;
			}
		});
		this.updateCurrentTime();
	}

	loop() {
		//if (!this.audioEl.paused) {
		//	const perc = ((this.audioEl.currentTime / this.duration) * 100).toString();
		//}
		if (this.audioEl.currentTime <= this.in) {
			this.audioEl.currentTime = this.in;
		}
		if (this.audioEl.currentTime >= this.out) {
			this.audioEl.currentTime = this.in;
			if (!this.audioEl.loop) {
				this.audioEl.pause();
			}
		}

		window.requestAnimationFrame(() => {
			this.loop();
		});
	}

	private togglePlay(): void {
		if (this.audioEl.paused) {
			this.audioEl.play();
			console.log("play");
			this.playButton.textContent = "⏸";
		} else {
			this.audioEl.pause();
			this.playButton.textContent = "⏵";
		}
	}

	private scrubAudio(): void {
		const scrubTime = (parseFloat(this.scrubInput.value) / 10000) * this.duration;
		this.audioEl.currentTime = scrubTime;
		this.updateCurrentTime();
	}

	private updateCurrentTime(): void {
		this.currentTimeDisplay.textContent = this.formatTime(this.audioEl.currentTime);
		this.scrubInput.value = String((this.audioEl.currentTime / this.duration) * 10000);

		const inPerc = (this.in / this.duration) * 10000;
		const outPerc = (this.out / this.duration) * 10000;
		const value = Math.min(Math.max(parseFloat(this.scrubInput.value), inPerc), outPerc) / 100;
		this.indicator.style.setProperty("--play-pos", `${value || 0}%`);

		window.requestAnimationFrame(() => {
			if (!this.audioEl.paused) {
				this.updateCurrentTime();
			}
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
}
