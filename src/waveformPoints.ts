const WIDTH = 400;
const HEIGHT = 200;
const BUCKETS = 24;

export const waveformPoints = (data: Float32Array, floor = 0.05): string => {
	const mid = HEIGHT / 2;

	if (data.length === 0) {
		return `0,${mid} ${WIDTH},${mid}`;
	}

	let peak = 0;
	for (let i = 0; i < data.length; i++) {
		const abs = Math.abs(data[i]);
		if (abs > peak) {
			peak = abs;
		}
	}
	const scale = 0.9 / Math.max(peak, floor);

	const bucketSize = Math.max(1, Math.floor(data.length / BUCKETS));
	const points: string[] = [];

	for (let b = 0; b < BUCKETS; b++) {
		const start = b * bucketSize;
		const end = Math.min(start + bucketSize, data.length);
		if (start >= end) {
			break;
		}

		let min = data[start];
		let max = data[start];
		for (let i = start + 1; i < end; i++) {
			if (data[i] < min) {
				min = data[i];
			}
			if (data[i] > max) {
				max = data[i];
			}
		}

		const x = Math.round((b / (BUCKETS - 1)) * WIDTH);
		const top = clamp(mid - max * scale * mid);
		const bottom = clamp(mid - min * scale * mid);

		/* alternate the stroke direction so the polyline never doubles back on itself */
		points.push(b % 2 === 0 ? `${x},${top} ${x},${bottom}` : `${x},${bottom} ${x},${top}`);
	}

	return points.join(" ");
};

const clamp = (value: number): number => Math.round(Math.min(Math.max(value, 0), HEIGHT));

export const flatWaveformPoints = (): string => `0,${HEIGHT / 2} ${WIDTH},${HEIGHT / 2}`;
