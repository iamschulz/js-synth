import {
	distortionCurve,
	distortionGain,
	linearCurve,
	overdriveCurve,
	overdriveGain,
} from "./ampCurves.ts";

const WET_EQ_DB = 2.3;
const CLIP_CEILING_DB = 16;

/**
 * Amp emulation sitting between a tone generator's voices and the master bus.
 *
 * Signal path:
 *
 *   input ─┬─ dry ──────────────────────────────────────────────┬─ output
 *          └─ pre EQ ─ overdrive ─ distortion ─ makeup ─ cab ─ wet ┘
 *
 * The parts that make this sound like a guitar rather than a clipped
 * synth:
 *
 * - The clipping runs on the summed voices instead of per note
 * - Bass is cut before the clipping stage
 * - Cabinet - playing around to get guitar-like tone
 */
export class DriveChain {
	ctx: AudioContext;
	input: GainNode;
	output: GainNode;

	private dry: GainNode;
	private wet: GainNode;
	private makeup: GainNode;
	private overdriveStage: WaveShaperNode;
	private distortionStage: WaveShaperNode;
	private coupling: BiquadFilterNode;
	private preEq: BiquadFilterNode[];
	private cabinet: BiquadFilterNode[];

	/* -1 rather than 0, so the constructor's setDrive(0, 0) is not swallowed by
	   the no-op guard and actually establishes the dry/wet split */
	private overdrive = -1;
	private distortion = -1;

	constructor(ctx: AudioContext, destination: AudioNode) {
		this.ctx = ctx;

		this.input = ctx.createGain();
		this.output = ctx.createGain();
		this.dry = ctx.createGain();
		this.wet = new GainNode(ctx, { gain: 0 }); // starts clean, so nothing bursts through on the first ramp
		this.makeup = ctx.createGain();

		/* Pre-gain tone shaping, Tube-Screamer style: drop the boom, push the mids that the clipping stage should limit */
		this.preEq = [
			new BiquadFilterNode(ctx, { type: "highpass", frequency: 110, Q: 0.707 }),
			new BiquadFilterNode(ctx, { type: "peaking", frequency: 720, Q: 0.8, gain: 4 }),
		];

		this.overdriveStage = ctx.createWaveShaper();
		this.overdriveStage.oversample = "4x";
		this.distortionStage = ctx.createWaveShaper();
		this.distortionStage.oversample = "4x";

		/* Coupling filter between the stages */
		this.coupling = new BiquadFilterNode(ctx, { type: "highpass", frequency: 90, Q: 0.707 });

		/* Speaker cabinet */
		this.cabinet = [
			new BiquadFilterNode(ctx, { type: "highpass", frequency: 85, Q: 0.707 }),
			new BiquadFilterNode(ctx, { type: "peaking", frequency: 110, Q: 1.2, gain: 3 }),
			new BiquadFilterNode(ctx, { type: "peaking", frequency: 420, Q: 1, gain: -4 }),
			new BiquadFilterNode(ctx, { type: "peaking", frequency: 2600, Q: 1.2, gain: 5 }),
			new BiquadFilterNode(ctx, { type: "lowpass", frequency: 5000, Q: 0.5412 }),
			new BiquadFilterNode(ctx, { type: "lowpass", frequency: 5000, Q: 1.3066 }),
		];

		/* dry path */
		this.input.connect(this.dry).connect(this.output);

		/* wet path */
		const chain = [
			...this.preEq,
			this.overdriveStage,
			this.coupling,
			this.distortionStage,
			this.makeup,
			...this.cabinet,
		];
		chain.reduce((from: AudioNode, to) => from.connect(to), this.input);
		chain[chain.length - 1].connect(this.wet).connect(this.output);

		this.output.connect(destination);

		this.setDrive(0, 0);
		this.setVolume(1);
	}

	setDrive(overdrive: number, distortion: number): void {
		if (overdrive === this.overdrive && distortion === this.distortion) {
			return;
		}

		this.overdrive = overdrive;
		this.distortion = distortion;

		this.overdriveStage.curve = overdrive > 0 ? overdriveCurve(overdrive) : linearCurve();
		this.distortionStage.curve = distortion > 0 ? distortionCurve(distortion) : linearCurve();

		const nominal =
			20 * Math.log10(overdriveGain(overdrive)) + 20 * Math.log10(distortionGain(distortion)) + WET_EQ_DB;
		const attenuation = nominal / Math.pow(1 + Math.pow(nominal / CLIP_CEILING_DB, 4), 1 / 4);
		this.ramp(this.makeup.gain, Math.pow(10, -attenuation / 20));

		/* Prevent click noise when changing settings */
		const wet = overdrive > 0 || distortion > 0 ? 1 : 0;
		this.ramp(this.wet.gain, wet);
		this.ramp(this.dry.gain, 1 - wet);
	}

	setVolume(volume: number): void {
		this.ramp(this.output.gain, volume);
	}

	private ramp(param: AudioParam, value: number): void {
		param.setTargetAtTime(value, this.ctx.currentTime, 0.01);
	}

	destroy(): void {
		[
			this.input,
			this.output,
			this.dry,
			this.wet,
			this.makeup,
			this.overdriveStage,
			this.distortionStage,
			this.coupling,
			...this.preEq,
			...this.cabinet,
		].forEach((node) => node.disconnect());
	}
}
