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
        this.controls = document.querySelector(".controls");

        this.keyboardControls();
        this.buttonControls();
        this.optionControls();
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
            btn.addEventListener("mousedown", (e) => {
                const key = btn.dataset.note;
                if (!key || !this.freqs[key]) return;

                this.playNote(key);
                e.preventDefault();
            });

            btn.addEventListener("touchstart", (e) => {
                const key = btn.dataset.note;
                if (!key || !this.freqs[key]) return;

                this.playNote(key);
                e.preventDefault();
            });

            /* change button while clicked */
            btn.addEventListener("mouseenter", (e) => {
                const key = btn.dataset.note;
                if (!e.buttons || !key || !this.freqs[key]) return;

                this.playNote(key);
                e.preventDefault();
            });

            /* release button */
            btn.addEventListener("mouseup", (e) => {
                const key = btn.dataset.note;
                if (!key || !this.freqs[key] || !this.nodes[key]) return;

                this.endNote(this.nodes[key]);
                e.preventDefault();
            });

            btn.addEventListener("mouseout", (e) => {
                const key = btn.dataset.note;
                if (!key || !this.freqs[key] || !this.nodes[key]) return;

                this.endNote(this.nodes[key]);
                e.preventDefault();
            });

            btn.addEventListener("touchend", (e) => {
                const key = btn.dataset.note;
                if (!key || !this.freqs[key] || !this.nodes[key]) return;

                this.endNote(this.nodes[key]);
                e.preventDefault();
            });

            btn.addEventListener("touchcancel", (e) => {
                const key = btn.dataset.note;
                if (!key || !this.freqs[key] || !this.nodes[key]) return;

                this.endNote(this.nodes[key]);
                e.preventDefault();
            });
        });
    }

    optionControls() {
        const applyOptions = () => {
            const data = Object.fromEntries(new FormData(this.controls));
            this.wave = data.waveform;
            this.offset = parseInt(data.offset) + 5;
        }
        
        this.controls.addEventListener("change", () => {
            applyOptions();
        })

        applyOptions();
    }
}

new Synth();