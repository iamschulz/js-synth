import { Controls } from "./Controls.ts";
import { getMidiCode } from "./keys.ts";

type MidiMessage = {
	command: number;
	channel: number;
	note: number;
	velocity: number;
};

type Callback = (note: number, velocity?: number) => void;

type MidiConfig = {
	playCallback: Callback;
	releaseCallback: Callback;
	pitchCallback: Callback;
};

export class MidiAdapter {
	midi: MIDIAccess | null;
	inChannel: number;
	outChannel: number;
	playCallback: Callback;
	releaseCallback: Callback;
	pitchCallback: Callback;
	disabled: boolean;
	activeNotes: number;
	controls: Controls;

	constructor(config: MidiConfig) {
		this.midi = null;
		this.controls = new Controls(
			"midiConfig",
			document.querySelector("#midi-controls") as HTMLFormElement,
			(data) => {
				this.inChannel = parseInt(data["midiIn"] as string);
				this.outChannel = parseInt(data["midiOut"] as string);
				this.checkRequirements();
			}
		);

		this.playCallback = config.playCallback;
		this.releaseCallback = config.releaseCallback;
		this.pitchCallback = config.pitchCallback;

		this.disabled = false;

		this.inChannel >= 0 && this.outChannel >= 0 && this.checkRequirements();

		this.activeNotes = 0;
	}

	/**
	 * Checks if browser meets requirements and grants permissions
	 *
	 * @returns
	 */
	checkRequirements(): void {
		if (!navigator.requestMIDIAccess) {
			this.disableMidi();
			console.warn("MIDI not supported in this browser.");
			return;
		}

		if (
			(this.inChannel < 0 || this.inChannel === undefined) &&
			(this.outChannel < 0 || this.outChannel === undefined)
		) {
			return;
		}

		navigator
			.requestMIDIAccess()
			.then(this.onMIDISuccess.bind(this))
			.catch((e) => {
				console.error("MIDI access failed:", e);
				this.disableMidi();
			});
	}

	/**
	 * Initializes the MIDI adapter.
	 *
	 * @param midiAccess - The granted MIDI access.
	 */
	onMIDISuccess(midiAccess: MIDIAccess): void {
		console.log("MIDI access granted.");
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

		if (velocity === 0) {
			this.activeNotes--;
		} else {
			this.activeNotes++;
		}
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
			this.releaseCallback(data.note);
		}

		if (data.channel === this.inChannel && data.command === 8) {
			this.releaseCallback(data.note);
		}

		if (data.channel === this.inChannel && data.command === 14) {
			this.pitchCallback(data.velocity);
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
		if (this.outChannel < 0 || command !== "play" || !this.midi) {
			return;
		}

		const midiCode = getMidiCode(note) as any; // todo: fix typing
		const midiCommand = "0x" + ((9 << 4) | this.outChannel).toString(16);
		const midiVelocity = "0x" + (velocity * 127).toString(16);

		this.midi!.outputs.forEach((outputDevice) => {
			outputDevice.send([midiCommand, midiCode, midiVelocity]);
		});
	}

	/**
	 * Disables MIDI option UI.
	 */
	disableMidi(): void {
		this.disabled = true;
		window.requestAnimationFrame(() => {
			this.controls.toggleDisable();
		});
	}
}
