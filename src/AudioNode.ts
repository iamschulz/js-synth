import { SamplePlayer } from "./SamplePlayer.ts";

export type MyAudioNode = {
	node: OscillatorNode | AudioBufferSourceNode | SamplePlayer;
	release: GainNode;
};
