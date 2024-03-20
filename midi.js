export class MidiAdapter {
	constructor() {
		this.midi = null;
		navigator
			.requestMIDIAccess()
			.then(this.onMIDISuccess.bind(this), this.onMIDIFailure.bind(this));
	}

	onMIDISuccess(midiAccess) {
		console.log("MIDI ready!");
		this.midi = midiAccess;
	}

	onMIDIFailure(msg) {
		console.error(`Failed to get MIDI access - ${msg}`);
	}

	parseMidiMessage(message) {
		return {
			command: message[0] >> 4,
			channel: message[0] & 0xf,
			note: message[1],
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
			(data.command === 9 && data.velocity === 0)
		) {
			this.releaseNote(data);
		}
	}

	pressNote(data) {
		console.log("press note", data.note, data.velocity);
	}

	releaseNote(data) {
		console.log("release note", data.note);
	}
}
