import Keys from "./keys.js";

type MidiMessage = {
	command: number;
	channel: number;
	note: number;
	velocity: number;
};

type Callback = (note: number, velocity: number) => void;

type MidiConfig = {
	playCallback: Callback;
	releaseCallback: Callback;
};

export class MidiAdapter {
	midi: MIDIAccess | null;
	inSelector: HTMLSelectElement;
	outSelector: HTMLSelectElement;
	inChannel: number;
	outChannel: number;
	playCallback: Callback;
	releaseCallback: Callback;

	constructor(config: MidiConfig) {
		this.midi = null;
		this.inSelector = document.querySelector("#midiIn")!;
		this.outSelector = document.querySelector("#midiOut")!;
		this.watchChannelOptions();

		this.playCallback = config.playCallback;
		this.releaseCallback = config.releaseCallback;

		this.inChannel = parseInt(this.inSelector.value);
		this.outChannel = parseInt(this.outSelector.value);

		this.inChannel >= 0 && this.outChannel >= 0 && this.init();
	}

	init() {
		if (!navigator.requestMIDIAccess) {
			this.disableMidi();
			return;
		}

		navigator
			.requestMIDIAccess()
			.then(this.onMIDISuccess.bind(this))
			.catch(() => {
				this.disableMidi();
			});
	}

	onMIDISuccess(midiAccess: MIDIAccess) {
		this.midi = midiAccess;

		for (const entry of midiAccess.outputs) {
			const output = entry[1];
			console.log(
				`Output port [type:'${output.type}'] id:'${output.id}' manufacturer:'${output.manufacturer}' name:'${output.name}' version:'${output.version}'`
			);
		}

		this.watchMidiInput();
	}

	public onPlayNote(key: string, velocity: number) {
		this.sendMidiMessage("play", key, velocity);
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
			this.playCallback(data.note, data.velocity);
		}
		if (
			(data.channel === this.inChannel && data.command === 8) ||
			(data.channel === this.inChannel && data.command === 9 && data.velocity === 0)
		) {
			this.releaseCallback(data.note, data.velocity);
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
			console.log("MIDI:", this.outChannel, midiCommand, midiCode, midiVelocity);
			outputDevice.send([midiCommand, midiCode, midiVelocity]);
		});
	}

	pressNote(data: MidiMessage) {
		this.playCallback(data.note, data.velocity);
	}

	releaseNote(data: MidiMessage) {
		this.releaseCallback(data.note, data.velocity);
	}

	watchChannelOptions() {
		if (!this.midi) {
			this.init();
		}

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
