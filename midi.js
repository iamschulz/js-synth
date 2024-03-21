export class MidiAdapter {
	constructor() {
		this.midi = null;
		navigator.requestMIDIAccess().then(this.onMIDISuccess.bind(this));
	}

	onMIDISuccess(midiAccess) {
		this.midi = midiAccess;
		this.startLoggingMIDIInput();
	}

	startLoggingMIDIInput() {
		this.midi.inputs.forEach((entry) => {
			console.log(entry);
			entry.onmidimessage = (x) => this.onMIDIMessage(x);
		});
	}

	parseMidiMessage(message) {
		return {
			command: message[0] >> 4,
			channel: message[0] & 0xf,
			note: parseInt(message[1]),
			velocity: message[2] / 127,
		};
	}

	onMIDIMessage(event) {
		let str = "";
		for (const character of event.data) {
			str += `0x${character.toString(16)} `;
		}
		str = str.trim();
		if (str === "0xfe") {
			return;
		}
		const message = str.split(" ");
		const data = this.parseMidiMessage(message);

		if (data.channel === 0 && data.command === 9 && data.velocity > 0) {
			this.pressNote(data);
		}
		if (
			(data.channel === 0 && data.command === 8) ||
			(data.channel === 0 && data.command === 9 && data.velocity === 0)
		) {
			this.releaseNote(data);
		}
	}

	pressNote(data) {
		const event = new CustomEvent("midikeydown", {
			detail: {
				note: data.note,
				velocity: data.velocity,
			},
		});
		document.dispatchEvent(event);
	}

	releaseNote(data) {
		const event = new CustomEvent("midikeyup", {
			detail: {
				note: data.note,
				velocity: data.velocity,
			},
		});
		document.dispatchEvent(event);
	}
}
