import Freqs from "./freqs.js";
import Keys from "./keys.js";

class Synth {
    constructor() {
        this.freqs = Freqs;
        this.keys = Keys;
        this.wave = "sine";
        this.offset = 4;
        this.nodes = {};
        this.keyBtns = document.querySelectorAll(".keyboard button");
        this.waveCtrl = document.querySelector('[data-control-name="waveform"]');
        this.offsetCtrl = document.querySelector('[data-control-name="offset"]');

        this.keyboardControls();
        this.buttonControls();
        this.controlWave();
        this.controlOffset();
    }

    playNote(key = "a") {
        const ctx = new AudioContext();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const freq = this.freqs[key] * this.offset || 440;

        o.type = this.wave;
        o.connect(g);
        o.frequency.value = freq;
        g.connect(ctx.destination);
        o.start(0);

        Array.from(this.keyBtns)
            .filter((btn) => btn.dataset.note === key)[0]
            .classList.add("active");

        this.nodes[key] = {
            ctx: ctx,
            o: o,
            g: g,
        };
    }

    endNote(node) {
        const hallDuration = 1;
        const ctx = node.ctx;
        const g = node.g;

        g.gain.exponentialRampToValueAtTime(
            0.00001,
            ctx.currentTime + hallDuration
        );

        window.setTimeout(() => {
            ctx.close();
        }, 1000 * hallDuration);

        Object.keys(this.nodes).forEach((key) => {
            if (this.nodes[key] === node) {
                Array.from(this.keyBtns)
                    .filter((btn) => btn.dataset.note === key)[0]
                    .classList.remove("active");

                delete this.nodes[key];
            }
        });
    }

    keyboardControls() {
        document.addEventListener("keydown", (e) => {
            if (
                !this.keys[e.keyCode] || // key doesn't have a note
                this.nodes[this.keys[e.keyCode]] // note is already playing
            )
                return;

            this.playNote(this.keys[e.keyCode]);
        });

        document.addEventListener("keyup", (e) => {
            if (!this.keys[e.keyCode] || !this.nodes[this.keys[e.keyCode]])
                return;

            this.endNote(this.nodes[this.keys[e.keyCode]]);
        });
    }

    buttonControls() {
        this.keyBtns.forEach((btn) => {

            /*  click button */
            btn.addEventListener("mousedown", () => {
                const key = btn.dataset.note;
                if (!key || !this.freqs[key]) return;

                this.playNote(key);
            });

            btn.addEventListener("touchstart", () => {
                const key = btn.dataset.note;
                if (!key || !this.freqs[key]) return;

                this.playNote(key);
            });

            /* change button while clicked */
            btn.addEventListener("mouseenter", (e) => {
                const key = btn.dataset.note;
                if (!e.buttons || !key || !this.freqs[key]) return;

                this.playNote(key);
            });

            /* release button */
            btn.addEventListener("mouseup", () => {
                const key = btn.dataset.note;
                if (!key || !this.freqs[key] || !this.nodes[key]) return;

                this.endNote(this.nodes[key]);
            });

            btn.addEventListener("mouseout", () => {
                const key = btn.dataset.note;
                if (!key || !this.freqs[key] || !this.nodes[key]) return;

                this.endNote(this.nodes[key]);
            });

            btn.addEventListener("touchend", () => {
                const key = btn.dataset.note;
                if (!key || !this.freqs[key] || !this.nodes[key]) return;

                this.endNote(this.nodes[key]);
            });

            btn.addEventListener("touchcancel", () => {
                const key = btn.dataset.note;
                if (!key || !this.freqs[key] || !this.nodes[key]) return;

                this.endNote(this.nodes[key]);
            });
        });
    }

    controlWave() {
        this.waveCtrl.addEventListener("change", () => {
            this.wave = this.waveCtrl.value.toLowerCase();
        });

        this.wave = this.waveCtrl.value.toLowerCase();
    }

    controlOffset() {
        this.offsetCtrl.addEventListener("change", () => {
            this.offset = parseInt(this.offsetCtrl.value) + 5;
        });

        this.offset = parseInt(this.offsetCtrl.value) + 5 || 4;
    }
}

new Synth();