import Freqs from "./freqs.js";
import Keys from "./keys.js";

class Synth {
	constructor() {
		if (!window.AudioContext) {
			document.querySelector("dialog").setAttribute("open", "open");
			return;
		}

		this.freqs = Freqs;
		this.keys = Keys;
		this.wave = "sine";
		this.threshold = 0.001;
		this.attack = 0;
		this.decay = 0;
		this.sustain = 50;
		this.release = 0;
		this.pitch = 0;
		this.nodes = {};
		this.keyBtns = document.querySelectorAll(".keyboard button");
		this.controls = document.querySelector(".controls");
		this.headerDiagram = document.querySelector("#header-vis");

		this.keyboardControls();
		this.buttonControls();
		this.optionControls();
		this.updateLegend();
	}

	/**
	 * Called when a note starts playing
	 *
	 * @param {String} key
	 */
	playNote(key = "a") {
		const ctx = new window.AudioContext();
		const osc = ctx.createOscillator();
		const attack = ctx.createGain();
		const decay = ctx.createGain();
		const release = ctx.createGain();
		const freq = this.getFreq(key);

		/* configure oscillator */
		osc.type = this.wave;
		osc.connect(attack);
		osc.frequency.value = freq;

		/* configure attack */
		attack.gain.setValueAtTime(0.00001, ctx.currentTime);
		if (this.attack > this.threshold) {
			attack.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + this.threshold + this.attack);
		} else {
			attack.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + this.threshold);
		}
		attack.connect(decay);

		/* configure decay */
		decay.gain.setValueAtTime(1, ctx.currentTime + this.attack);
		decay.gain.exponentialRampToValueAtTime(this.sustain / 100, ctx.currentTime + this.attack + this.decay);
		decay.connect(release);

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
		release.gain.setValueAtTime(0.9, ctx.currentTime);
		release.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + Math.max(this.release, this.threshold));

		window.setTimeout(() => {
			ctx.close();
		}, 1000 * Math.max(this.release, this.threshold));

		Object.keys(this.nodes).forEach((key) => {
			if (this.nodes[key] === node) {
				Array.from(this.keyBtns)
					.filter((btn) => btn.dataset.note === key)[0]
					.classList.remove("active");

				delete this.nodes[key];
			}
		});
	}

	getFreq(key) {
		let freq = this.freqs[key] || 440;

		for (let i = 0; i <= this.pitch; i++) {
			freq = freq * 2;
		}

		return freq;
	}

	keyboardControls() {
		document.addEventListener("keydown", (e) => {
			if (
				!this.keys[e.code] || // key doesn't have a note
				this.nodes[this.keys[e.code]] // note is already playing
			)
				return;

			this.playNote(this.keys[e.code]);
		});

		document.addEventListener("keyup", (e) => {
			if (!this.keys[e.code] || !this.nodes[this.keys[e.code]]) return;

			this.endNote(this.nodes[this.keys[e.code]]);
		});
	}

	buttonControls() {
		this.keyBtns.forEach((btn) => {
			/*  click button */
			btn.addEventListener(
				"mousedown",
				(e) => {
					const key = btn.dataset.note;
					if (!key || !this.freqs[key]) return;

					this.playNote(key);
				},
				{ passive: true }
			);

			btn.addEventListener(
				"touchstart",
				(e) => {
					const key = btn.dataset.note;
					if (!key || !this.freqs[key]) return;

					this.playNote(key);
				},
				{ passive: true }
			);

			/* change button while clicked */
			btn.addEventListener(
				"mouseenter",
				(e) => {
					const key = btn.dataset.note;
					if (!e.buttons || !key || !this.freqs[key]) return;

					this.playNote(key);
				},
				{ passive: true }
			);

			/* trigger button with tab controls */
			btn.addEventListener("keydown", (e) => {
				if (!(e.code === "Space" || e.key === "Enter")) return;

				this.playNote(e.target.dataset.note);
			});

			/* release button */
			btn.addEventListener(
				"mouseup",
				(e) => {
					const key = btn.dataset.note;
					if (!key || !this.freqs[key] || !this.nodes[key]) return;

					this.endNote(this.nodes[key]);
				},
				{ passive: true }
			);

			btn.addEventListener(
				"mouseout",
				(e) => {
					const key = btn.dataset.note;
					if (!key || !this.freqs[key] || !this.nodes[key]) return;

					this.endNote(this.nodes[key]);
				},
				{ passive: true }
			);

			btn.addEventListener(
				"touchend",
				(e) => {
					const key = btn.dataset.note;
					if (!key || !this.freqs[key] || !this.nodes[key]) return;

					this.endNote(this.nodes[key]);
				},
				{ passive: true }
			);

			btn.addEventListener(
				"touchcancel",
				(e) => {
					const key = btn.dataset.note;
					if (!key || !this.freqs[key] || !this.nodes[key]) return;

					this.endNote(this.nodes[key]);
				},
				{ passive: true }
			);

			btn.addEventListener("keyup", (e) => {
				const key = btn.dataset.note;
				if (!(e.code === "Space" || e.key === "Enter")) return;
				if (!key || !this.freqs[key] || !this.nodes[key]) return;

				this.endNote(this.nodes[key]);
			});

			btn.addEventListener("blur", (e) => {
				const key = btn.dataset.note;
				if (!key || !this.freqs[key] || !this.nodes[key]) return;

				this.endNote(this.nodes[key]);
			});
		});
	}

	optionControls() {
		const applyOptions = () => {
			const data = Object.fromEntries(new FormData(this.controls));
			this.wave = data.waveform;
			this.attack = parseFloat(data.attack) + 0.001;
			this.decay = parseFloat(data.decay) + 0.001;
			this.sustain = parseFloat(data.sustain);
			this.release = parseFloat(data.release) + 0.001;
			this.pitch = parseInt(data.pitch);
			this.drawWave();
			this.drawAdsr();

			localStorage.synthConfig = JSON.stringify({
				wave: this.wave,
				attack: this.attack,
				decay: this.decay,
				sustain: this.sustain,
				release: this.release,
				pitch: this.pitch,
			});
		};

		this.controls.addEventListener("change", () => {
			applyOptions();
		});

		this.restoreConfig();

		applyOptions();
	}

	restoreConfig() {
		if (!localStorage.synthConfig) return;

		const synthConfig = JSON.parse(localStorage.synthConfig);
		Object.keys(synthConfig).map((conf) => {
			this[synthConfig] = synthConfig[conf];

			if (conf === "wave") {
				this.controls
					.querySelector(`[name=waveform][value=${synthConfig[conf]}`)
					.setAttribute("checked", "checked");
			} else {
				this.controls.querySelector(`#${conf}`).value = synthConfig[conf];
			}
		});
	}

	drawWave() {
		const waveDiagrams = this.headerDiagram.querySelectorAll('[id^="wave"]');
		waveDiagrams.forEach((waveDiagram) => {
			waveDiagram.toggleAttribute("hidden", waveDiagram.id !== `wave-${this.wave}`);
		});
	}

	drawAdsr() {
		// header diagram is 400 x 200
		const a = this.headerDiagram.querySelector("#adsr-a");
		const d = this.headerDiagram.querySelector("#adsr-d");
		const s = this.headerDiagram.querySelector("#adsr-s");
		const r = this.headerDiagram.querySelector("#adsr-r");

		const ax = this.attack * 50 - 0.05;
		const dx = (this.decay - 0.001) * 20 + ax;
		const sy = 200 - this.sustain * 2;
		const rx = 400 - this.release * 10 + 0.01;

		a.toggleAttribute("hidden", ax === 0);
		a.setAttribute("x2", ax);

		d.toggleAttribute("hidden", dx === 0);
		d.setAttribute("x1", ax);
		d.setAttribute("x2", dx);
		d.setAttribute("y2", sy);

		s.setAttribute("x1", dx);
		s.setAttribute("y1", sy);
		s.setAttribute("x2", rx);
		s.setAttribute("y2", sy);

		r.toggleAttribute("hidden", rx === 400);
		r.setAttribute("x1", rx);
		r.setAttribute("y1", sy);
	}

	async updateLegend() {
		if (!navigator.keyboard?.getLayoutMap) {
			return;
		}

		const layoutMap = await navigator.keyboard.getLayoutMap();
		Object.keys(this.keys).forEach((key) => {
			const note = this.keys[key];
			const keyBtn = document.querySelector(`[data-note=${note}]`);
			const keyText = layoutMap.get(key);
			keyBtn.textContent = keyText;
		});
	}
}

new Synth();

window.onload = () => {
	"use strict";
	if ("serviceWorker" in navigator) {
		navigator.serviceWorker.register("./serviceworker.js");
	}
};
