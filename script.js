import Freqs from "./freqs.js";
import Keys from "./keys.js";

class Synth {
    constructor() {
        this.freqs = Freqs;
        this.keys = Keys;
        this.wave = "sine";
        this.attack = 0;
        this.delay = 0;
        this.release = 0;
        this.offset = 4;
        this.nodes = {};
        this.keyBtns = document.querySelectorAll(".keyboard button");
        this.controls = document.querySelector(".controls");

        this.keyboardControls();
        this.buttonControls();
        this.optionControls();
    }

    /**
     * Called when a note starts playing
     * 
     * @param {String} key 
     */
    playNote(key = "a") {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const attack = ctx.createGain();
        const delay = ctx.createGain();
        const release = ctx.createGain();
        const freq = this.freqs[key] * this.offset || 440;

        /* configure oscillator */
        osc.type = this.wave;
        osc.connect(attack);
        osc.frequency.value = freq;

        /* configure attack */
        if (this.attack > 0.01) {
            attack.gain.setValueAtTime(0.00001, ctx.currentTime);
            attack.gain.exponentialRampToValueAtTime(
                1,
                ctx.currentTime + this.attack
            );
        }
        attack.connect(delay);

        /* configure delay */
        if (this.delay > 0.001) {
            delay.gain.setValueAtTime(1, ctx.currentTime + this.attack);
            delay.gain.exponentialRampToValueAtTime(
                0.2,
                ctx.currentTime + this.attack + this.delay
            );
        }
        delay.connect(release);
        
        release.connect(ctx.destination);
        osc.start(0);

        Array.from(this.keyBtns)
            .filter((btn) => btn.dataset.note === key)[0]
            .classList.add("active");

        this.nodes[key] = {
            ctx: ctx,
            osc: osc,
            release: release,
        };
    }

    /**
     * Called when a node stops playing
     * 
     * @param {Object} node 
     */
    endNote(node) {
        const ctx = node.ctx;
        const release = node.release;

        /* configure release */
        release.gain.exponentialRampToValueAtTime(
            0.00001,
            ctx.currentTime + this.release
        );

        window.setTimeout(() => {
            ctx.close();
        }, 1000 * this.release);

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
            this.attack = parseInt(data.attack) / 1000 + 0.01;
            this.delay = parseInt(data.delay) / 1000 + 0.001;
            this.release = parseInt(data.release) / 1000 + 0.1;
            this.offset = parseInt(data.offset) + 5;
        }
        
        this.controls.addEventListener("change", () => {
            applyOptions();
        })

        applyOptions();
    }
}

new Synth();