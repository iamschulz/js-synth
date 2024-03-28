import Keys from "./keys.js";

type MidiMessage = {
	command: number;
	channel: number;
	note: number;
	velocity: number;
};

export class MidiAdapter {
	midi: MIDIAccess | null;
	inSelector: HTMLSelectElement;
	outSelector: HTMLSelectElement;
	inChannel: number;
	outChannel: number;

	constructor() {
		this.midi = null;
		this.inSelector = document.querySelector("#midiIn")!;
		this.outSelector = document.querySelector("#midiOut")!;
		this.watchChannelOptions();
		const permissionOpts = {
			name: "midi" as PermissionName,
			sysex: true,
		} as PermissionDescriptor;
		navigator.permissions.query(permissionOpts).then((permission) => {
			if (permission.state === "granted" || permission.state === "prompt") {
				this.init();
			} else {
				this.disableMidi();
			}
		});
	}

	init() {
		navigator.requestMIDIAccess().then(this.onMIDISuccess.bind(this));
		this.inChannel = parseInt(this.inSelector.value);
		this.outChannel = parseInt(this.outSelector.value);
	}

	onMIDISuccess(midiAccess: MIDIAccess) {
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
		this.midi!.inputs.forEach((inputDevice) => {
			inputDevice.onmidimessage = (x) => this.onMIDIMessage(x);
		});
	}

	parseMidiMessage(message: string): MidiMessage {
		const arr = message.split(" ");
		return {
			command: parseInt(arr[0]) >> 4,
			channel: parseInt(arr[0]) & 0xf,
			note: parseInt(arr[1]),
			velocity: parseInt(arr[2]) / 127,
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
		const data = this.parseMidiMessage(str);

		if (data.channel === this.inChannel && data.command === 9 && data.velocity > 0) {
			this.pressNote(data);
		}
		if (
			(data.channel === this.inChannel && data.command === 8) ||
			(data.channel === this.inChannel && data.command === 9 && data.velocity === 0)
		) {
			this.releaseNote(data);
		}
	}

	sendMidiMessage(command: string, note: string, velocity = 0) {
		if (!this.outChannel || !command) {
			return;
		}

		const midiCode = Keys[note].midiIn;
		const midiCommand = "0x" + ((9 << 4) | this.outChannel).toString(16);
		const midiVelocity = "0x" + (velocity * 127).toString(16);

		this.midi!.outputs.forEach((outputDevice) => {
			outputDevice.send([midiCommand, midiCode, midiVelocity]);
		});
	}

	pressNote(data: MidiMessage) {
		const event = new CustomEvent("midikeydown", {
			detail: {
				note: data.note,
				velocity: data.velocity,
			},
		});
		document.dispatchEvent(event);
	}

	releaseNote(data: MidiMessage) {
		const event = new CustomEvent("midikeyup", {
			detail: {
				note: data.note,
				velocity: data.velocity,
			},
		});
		document.dispatchEvent(event);
	}

	watchChannelOptions() {
		this.inSelector.addEventListener("input", () => {
			this.inChannel = parseInt(this.inSelector.value);
		});

		this.outSelector.addEventListener("input", () => {
			this.outChannel = parseInt(this.outSelector.value);
		});
	}

	disableMidi() {
		this.inSelector.setAttribute("disabled", "disabled");
		this.outSelector.setAttribute("disabled", "disabled");
	}
}
