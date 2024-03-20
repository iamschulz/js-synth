export class MidiAdapter {
	constructor() {
		this.midi = null; // global MIDIAccess object
		navigator
			.requestMIDIAccess()
			.then(this.onMIDISuccess.bind(this), this.onMIDIFailure.bind(this));
	}

	onMIDISuccess(midiAccess) {
		console.log("MIDI ready!");
		this.midi = midiAccess; // store in the global (in real usage, would probably keep in an object instance)
		this.startLoggingMIDIInput();
	}

	onMIDIFailure(msg) {
		console.error(`Failed to get MIDI access - ${msg}`);
	}

	startLoggingMIDIInput() {
		this.midi.inputs.forEach((entry) => {
			entry.onmidimessage = this.onMIDIMessage;
		});
	}

	onMIDIMessage(event) {
		let str = "";
		for (const character of event.data) {
			str += `0x${character.toString(16)} `;
		}
		if (str === "0xfe") {
			return;
		}
		console.log(str);
	}
}
