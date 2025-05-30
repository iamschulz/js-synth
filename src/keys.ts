const baseNotes = ["c", "cs", "d", "eb", "e", "f", "fs", "g", "gs", "a", "bb", "b"];

export const keyBindings = [
	"KeyA",
	"KeyS",
	"KeyD",
	"KeyF",
	"KeyG",
	"KeyH",
	"KeyJ",
	"KeyK",
	"KeyL",
	"Semicolon",
	"Quote",
	"Backslash",
	"KeyQ",
	"KeyW",
	"KeyE",
	"KeyR",
	"KeyT",
	"KeyY",
	"KeyU",
	"KeyI",
	"KeyO",
	"KeyP",
	"BracketLeft",
	"BracketRight",
	"Digit1",
	"Digit2",
	"Digit3",
	"Digit4",
	"Digit5",
	"Digit6",
	"Digit7",
	"Digit8",
	"Digit9",
	"Digit0",
	"Minus",
	"Equal",
];

export const getNote = (input: string | number) => {
	if (typeof input === "number") {
		const octave = Math.floor(input / 12);
		const note = baseNotes[input % 12];
		return `${note}${octave}`;
	}

	if (typeof input === "string") {
		// input is keyCode
		const index = keyBindings.indexOf(input);
		if (index === -1) {
			return null;
		}
		const octave = Math.floor(index / 12);
		const note = baseNotes[index % 12];
		return `${note}${octave}`;
	}
};

export const getMidiCode = (noteName: string) => {
	const [note, octave] = noteName.split("");
	const noteIndex = baseNotes.indexOf(note);
	if (noteIndex === -1) {
		return null;
	}
	const midiCode = noteIndex + parseInt(octave) * 12;
	return midiCode;
};

export const getKeyName = (noteName: string) => {
	const [note, octave] = noteName.split("");
	const noteIndex = baseNotes.indexOf(note);
	if (noteIndex === -1) {
		return null;
	}
	const keyIndex = noteIndex + parseInt(octave) * 12;
	if (keyIndex < 0 || keyIndex >= keyBindings.length) {
		return null;
	}
	return keyBindings[keyIndex];
};
