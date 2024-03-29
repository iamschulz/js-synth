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

		this.inChannel >= 0 && this.outChannel >= 0 && this.checkRequirements();
	}

	/**
	 * Checks if browser meets requirements and grants permissions
	 *
	 * @returns
	 */
	checkRequirements(): void {
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

	/**
	 * Initializes the MIDI adapter.
	 *
	 * @param midiAccess - The granted MIDI access.
	 */
	onMIDISuccess(midiAccess: MIDIAccess): void {
		this.midi = midiAccess;

		for (const entry of midiAccess.outputs) {
			const output = entry[1];
			console.log(
				`Output port [type:'${output.type}'] id:'${output.id}' manufacturer:'${output.manufacturer}' name:'${output.name}' version:'${output.version}'`
			);
		}

		this.watchMidiInput();
	}

	/**
	 * Callback for MIDI-out from in-browser inputs.
	 *
	 * @param key - The key, e.g. 'c2'.
	 * @param velocity - The velocity of the key.
	 */
	public onPlayNote(key: string, velocity: number): void {
		this.sendMidiMessage("play", key, velocity);
	}

	/**
	 * Handles MIDI-in.
	 */
	watchMidiInput(): void {
		this.midi!.inputs.forEach((inputDevice) => {
			inputDevice.onmidimessage = (x) => this.onMIDIMessage(x);
		});
	}

	/**
	 * Translates a MIDI-in signal into a readable JSON object.
	 *
	 * @param message - The MIDI-in signal
	 * @returns - The MIDI signal object.
	 */
	parseMidiMessage(message: string): MidiMessage {
		const arr = message.split(" ");
		return {
			command: parseInt(arr[0]) >> 4,
			channel: parseInt(arr[0]) & 0xf,
			note: parseInt(arr[1]),
			velocity: parseInt(arr[2]) / 127,
		};
	}

	/**
	 * Callback for MIDI input.
	 *
	 * @param event - The MIDI event.
	 * @returns
	 */
	onMIDIMessage(event): void {
		// todo: type event
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

	/**
	 * Sends out a MIDI message.
	 *
	 * @param command - The MIDI command.
	 * @param note - The MIDI note.
	 * @param velocity - The velocity.
	 * @returns
	 */
	sendMidiMessage(command: string, note: string, velocity = 0): void {
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

	/**
	 * Handles MIDI option changes.
	 */
	watchChannelOptions(): void {
		if (!this.midi) {
			this.checkRequirements();
		}

		this.inSelector.addEventListener("input", () => {
			this.inChannel = parseInt(this.inSelector.value);
		});

		this.outSelector.addEventListener("input", () => {
			this.outChannel = parseInt(this.outSelector.value);
		});
	}

	/**
	 * Disables MIDI option UI.
	 */
	disableMidi(): void {
		this.inSelector.setAttribute("disabled", "disabled");
		this.outSelector.setAttribute("disabled", "disabled");
	}
}
