export class AudioTrack {
	id: number;
	src: string | null;
	recordingsList: HTMLUListElement;
	template: HTMLTemplateElement;
	element: HTMLElement;
	audioEl: HTMLAudioElement;
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
		this.audioEl.addEventListener("durationchange", () => {
			const duration = this.audioEl.duration.toFixed(2);
			this.outCtrl.value = duration;
			this.out = parseFloat(duration);
			this.outCtrl.max = duration;
		});
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
	}

	handleTimingControls() {
		this.inCtrl.addEventListener("change", () => {
			this.in = parseFloat(this.inCtrl.value);
		});

		this.outCtrl.addEventListener("change", () => {
			this.out = parseFloat(this.outCtrl.value);
		});

		this.loopBtn.addEventListener("click", () => {
			this.audioEl.loop = !this.audioEl.loop;
			this.loopBtn.ariaPressed = this.audioEl.loop.toString();
		});
	}

	loop() {
		if (!this.audioEl.paused) {
			const perc = ((this.audioEl.currentTime / this.audioEl.duration) * 100).toString();
		}
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

	delete() {
		this.element.remove();
	}
}
