export const createSynthControls = (i: string): string => `
<form class="synth-controls" id="synth-controls-${i}">
    <div class="controls-box">
        <input type="radio" id="waveform-sine-${i}" name="waveform-${i}" value="sine" checked />
        <label for="waveform-sine-${i}">Sine</label>

        <input type="radio" id="waveform-square-${i}" name="waveform-${i}" value="square" />
        <label for="waveform-square-${i}">Square</label>

        <input type="radio" id="waveform-triangle-${i}" name="waveform-${i}" value="triangle" />
        <label for="waveform-triangle-${i}">Triangle</label>

        <input type="radio" id="waveform-sawtooth-${i}" name="waveform-${i}" value="sawtooth" />
        <label for="waveform-sawtooth-${i}">Sawtooth</label>

        <input type="radio" id="waveform-noise-${i}" name="waveform-${i}" value="noise" />
        <label for="waveform-noise-${i}">Noise</label>
    </div>

    <div class="controls-box">
        <div class="option">
            <label for="volume-${i}">Volume</label>
            <input name="volume-${i}" id="volume-${i}" type="range" data-control-name="pitch" min="0" max="99"
                value="99" />
        </div>

        <div class="option">
            <label for="pitch-${i}">Pitch</label>
            <input name="pitch-${i}" id="pitch-${i}" type="range" data-control-name="pitch" min="-1" max="8" value="3" />
        </div>

        <div class="option">
            <label for="attack-${i}">Attack</label>
            <input name="attack-${i}" id="attack-${i}" type="range" data-control-name="attack" min="0" max="2" step="0.05"
                value="0" />
        </div>

        <div class="option">
            <label for="decay-${i}">Decay</label>
            <input name="decay-${i}" id="decay-${i}" type="range" data-control-name="decay" min="0" max="5" step="0.1"
                value="0" />
        </div>

        <div class="option">
            <label for="sustain-${i}">Sustain</label>
            <input name="sustain-${i}" id="sustain-${i}" type="range" data-control-name="sustain" min="0" max="100"
                value="50" />
        </div>

        <div class="option">
            <label for="release-${i}">Release</label>
            <input name="release-${i}" id="release-${i}" type="range" data-control-name="release" min="0" max="10"
                step="0.1" value="0" />
        </div>

        <div class="option">
            <label for="distort-${i}">Distort</label>
            <input name="distort-${i}" id="distort-${i}" type="range" data-control-name="distort" min="0" max="500"
                step="10" value="0" />
        </div>

        <div class="option">
            <label for="overdrive-${i}">Overdrive</label>
            <input name="overdrive-${i}" id="overdrive-${i}" type="range" data-control-name="overdrive" min="0" max="11"
                step="1" value="0" />
        </div>
    </div>
</form>
`;
