/**
 * WaveShaper transfer curves modelled on a guitar amp's two gain stages.
 *
 * Both curves bake their drive into the shape instead of using a separate gain
 * node in front. The shaper's domain is [-1, 1], so keeping the pre-gain inside
 * the curve means nothing gets clamped at the curve's edge before it has been
 * saturated.
 *
 * Both are asymmetric: the negative half saturates earlier than the positive
 * one. A symmetric transfer function only produces odd harmonics, which is the
 * classic "digital fuzz" timbre. Tubes and diode clippers treat the two halves
 * differently and add even harmonics on top, which is what reads as warm
 * rather than buzzy.
 *
 * The asymmetry is expressed as a different *limit* per half rather than a
 * different gain or an input offset, so both halves keep the same slope at
 * zero. A slope discontinuity there would be crossover distortion, which is
 * audible as a rasp on quiet passages. It does leave a DC offset on the
 * output — that is what the coupling filters in DriveChain are for, exactly as
 * in the circuit being imitated.
 */

const RESOLUTION = 8192;

const buildCurve = (shape: (x: number) => number) => {
	const curve = new Float32Array(RESOLUTION);

	for (let i = 0; i < RESOLUTION; i++) {
		curve[i] = shape((i * 2) / (RESOLUTION - 1) - 1);
	}

	return curve;
};

type Curve = ReturnType<typeof buildCurve>;

const asymmetric = (x: number, drive: number, squash: number, saturate: (g: number) => number): number => {
	const ceiling = x >= 0 ? 1 : 1 - squash;
	return ceiling * saturate((drive * x) / ceiling);
};

const identity = buildCurve((x) => x);
export const linearCurve = (): Curve => identity;

export const overdriveGain = (amount: number): number => 1 + amount * 20;
export const distortionGain = (amount: number): number => 1 + amount * amount * 60;

export const overdriveCurve = (amount: number): Curve => {
	const drive = overdriveGain(amount);
	const squash = 0.28 * amount;

	return buildCurve((x) => asymmetric(x, drive, squash, Math.tanh));
};

export const distortionCurve = (amount: number): Curve => {
	const drive = distortionGain(amount);
	const sharpness = 1 + amount * 6;
	const squash = 0.2 * amount;

	/* g / (1 + |g|^s)^(1/s): bounded by ±1, slope 1 at the origin.
	   s = 1 is a gentle rational curve, large s approaches a hard clip. */
	const saturate = (g: number) => g / Math.pow(1 + Math.pow(Math.abs(g), sharpness), 1 / sharpness);

	return buildCurve((x) => asymmetric(x, drive, squash, saturate));
};
