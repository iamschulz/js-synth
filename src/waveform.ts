export const waveforms = ["sine", "square", "triangle", "sawtooth", "noise", "sample"] as const;
export type Waveform = (typeof waveforms)[number];
