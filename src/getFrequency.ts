export function getFrequency(note: string, pitch: number): number {
	const semitoneMap: Record<string, number> = {
		c: 0,
		cs: 1,
		db: 1,
		d: 2,
		ds: 3,
		eb: 3,
		e: 4,
		f: 5,
		fs: 6,
		gb: 6,
		g: 7,
		gs: 8,
		ab: 8,
		a: 9,
		as: 10,
		bb: 10,
		b: 11,
	};

	const match = note.toLowerCase().match(/^([a-g]{1}s?|[a-g]{1}b?)([-]?\d?)$/);

	if (!match) {
		throw new Error("Invalid note name: " + note);
	}

	const [, baseNote, octaveStr] = match;
	const semitone = semitoneMap[baseNote];
	const octave = octaveStr === "" ? 4 : parseInt(octaveStr);

	const semitonesFromA4 = semitone + (octave - 4) * 12 - 9;

	let freq = +(440 * Math.pow(2, semitonesFromA4 / 12)).toFixed(2);

	for (let i = 0; i <= pitch; i++) {
		freq = freq * 2;
	}

	return freq;
}
