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

export const getNote = (input: string | number): string | undefined => {
	if (typeof input === "number") {
		const octave = Math.floor(input / 12);
		const note = baseNotes[input % 12];
		return `${note}${octave}`;
	}

	if (typeof input === "string") {
		// input is keyCode
		const index = keyBindings.indexOf(input);
		if (index === -1) {
			return undefined;
		}
		const octave = Math.floor(index / 12);
		const note = baseNotes[index % 12];
		return `${note}${octave}`;
	}
};

export const midiOctaveOffset = 4;

const parseNoteName = (noteName: string): { noteIndex: number; octave: number } | null => {
	const match = noteName.match(/^([a-g](?:s|b)?)(-?\d+)$/);
	if (!match) {
		return null;
	}
	const noteIndex = baseNotes.indexOf(match[1]);
	if (noteIndex === -1) {
		return null;
	}
	return { noteIndex, octave: parseInt(match[2], 10) };
};

export const getMidiCode = (noteName: string) => {
	const parsed = parseNoteName(noteName);
	if (!parsed) {
		return null;
	}
	return parsed.noteIndex + (parsed.octave + midiOctaveOffset) * 12;
};

export const getKeyName = (noteName: string) => {
	const parsed = parseNoteName(noteName);
	if (!parsed) {
		return null;
	}
	const keyIndex = parsed.noteIndex + parsed.octave * 12;
	if (keyIndex < 0 || keyIndex >= keyBindings.length) {
		return null;
	}
	return keyBindings[keyIndex];
};
