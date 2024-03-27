import Keys from "./keys.js";

export class MidiAdapter {
	constructor() {
		this.midi = null;
		this.watchChannelOptions();
		navigator.permissions.query({ name: "midi", sysex: true }).then(permission => {
			if (permission.state === "granted" || permission.state === "prompt") {
				this.init();
			} else {
				this.disableMidi();
			}
		})
	}
	
	init() {
		navigator.requestMIDIAccess().then(this.onMIDISuccess.bind(this));
		this.inChannel = parseInt(document.querySelector("#midiIn").value);
		this.inChannel = parseInt(document.querySelector("#midiOut").value);
	}

	onMIDISuccess(midiAccess) {
		this.midi = midiAccess;

		for (const entry of midiAccess.outputs) {
			const output = entry[1];
			console.log(
				`Output port [type:'${output.type}'] id:'${output.id}' manufacturer:'${output.manufacturer}' name:'${output.name}' version:'${output.version}'`
			);
		}

		this.watchPlayActions();
		this.watchMidiInput();
	}

	watchPlayActions() {
		document.addEventListener("playnote", (e) => {
			this.sendMidiMessage("play", e.detail.note, e.detail.velocity);
		});
	}

	watchMidiInput() {
		this.midi.inputs.forEach((inputDevice) => {
			inputDevice.onmidimessage = (x) => this.onMIDIMessage(x);
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

		if (
			data.channel === this.inChannel &&
			data.command === 9 &&
			data.velocity > 0
		) {
			this.pressNote(data);
		}
		if (
			(data.channel === this.inChannel && data.command === 8) ||
			(data.channel === this.inChannel &&
				data.command === 9 &&
				data.velocity === 0)
		) {
			this.releaseNote(data);
		}
	}

	sendMidiMessage(command, note, velocity = 0) {
		if (!this.outChannel || !command) {
			return;
		}

		const midiCode = Keys[note].midiIn;
		const midiCommand = "0x" + ((9 << 4) | this.outChannel).toString(16);
		const midiVelocity = "0x" + (velocity * 127).toString(16);

		this.midi.outputs.forEach((outputDevice) => {
			outputDevice.send([midiCommand, midiCode, midiVelocity]);
		});
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

	watchChannelOptions() {
		document.querySelector("#midiIn").addEventListener("input", (e) => {
			this.inChannel = parseInt(e.target.value);
		});

		document.querySelector("#midiOut").addEventListener("input", (e) => {
			this.outChannel = parseInt(e.target.value);
		});
	}

	disableMidi() {
		document.querySelector("#midiIn").setAttribute("disabled", "disabled");
		document.querySelector("#midiOut").setAttribute("disabled", "disabled");
	}
}
