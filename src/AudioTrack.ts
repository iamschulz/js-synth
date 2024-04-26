export class AudioTrack {
	id: number;
	src: string | null;
	recordingsList: HTMLUListElement;
	template: HTMLTemplateElement;
	element: HTMLElement;
	audioEl: HTMLAudioElement;

	constructor(id: number) {
		this.template = document.querySelector("#recordingTemplate") as HTMLTemplateElement;
		this.recordingsList = document.querySelector("#recordingsList") as HTMLUListElement;

		this.id = id;
		this.src = null;

		const els = this.createNewAudioElement();
		this.element = els.el;
		this.audioEl = els.audio;
	}

	addSrc(src: string) {
		this.audioEl.src = src;
	}

	createNewAudioElement(): { el: HTMLElement; audio: HTMLAudioElement } {
		const content = this.template.content;
		const recordNode = content.firstElementChild!.cloneNode(true) as HTMLElement;
		this.recordingsList.appendChild(recordNode);
		const audioEl = recordNode.querySelector("audio") as HTMLAudioElement;
		audioEl.id = `recording${this.id}`;

		return {
			el: recordNode,
			audio: audioEl,
		};
	}

	delete() {
		this.element.remove();
	}
}
