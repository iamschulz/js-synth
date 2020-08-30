import Freqs from './freqs.js';
import Keys from './keys.js';

class Synth {
	constructor() {
		this.freqs = Freqs;
		this.keys = Keys;
		this.wave = 'sine';
		this.attack = 0;
		this.decay = 0;
		this.release = 0;
		this.pitch = 0;
		this.nodes = {};
		this.keyBtns = document.querySelectorAll('.keyboard button');
		this.controls = document.querySelector('.controls');
		this.headerDiagram = document.querySelector('#header-vis');

		this.keyboardControls();
		this.buttonControls();
		this.optionControls();
	}

	/**
	 * Called when a note starts playing
	 *
	 * @param {String} key
	 */
	playNote(key = 'a') {
		const ctx = new AudioContext();
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
		if (this.attack > 0.01) {
			attack.gain.setValueAtTime(0.00001, ctx.currentTime);
			attack.gain.exponentialRampToValueAtTime(
				1,
				ctx.currentTime + this.attack
			);
		}
		attack.connect(decay);

		/* configure decay */
		if (this.decay > 0.001) {
			decay.gain.setValueAtTime(1, ctx.currentTime + this.attack);
			decay.gain.exponentialRampToValueAtTime(
				0.2,
				ctx.currentTime + this.attack + this.decay
			);
		}
		decay.connect(release);

		release.connect(ctx.destination);
		osc.start(0);

		Array.from(this.keyBtns)
			.filter((btn) => btn.dataset.note === key)[0]
			.classList.add('active');

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
		release.gain.setValueAtTime(1, ctx.currentTime);
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
					.classList.remove('active');

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
		document.addEventListener('keydown', (e) => {
			if (
				!this.keys[e.keyCode] || // key doesn't have a note
				this.nodes[this.keys[e.keyCode]] // note is already playing
			)
				return;

			this.playNote(this.keys[e.keyCode]);
		});

		document.addEventListener('keyup', (e) => {
			if (!this.keys[e.keyCode] || !this.nodes[this.keys[e.keyCode]])
				return;

			this.endNote(this.nodes[this.keys[e.keyCode]]);
		});
	}

	buttonControls() {
		this.keyBtns.forEach((btn) => {
			/*  click button */
			btn.addEventListener('mousedown', (e) => {
				const key = btn.dataset.note;
				if (!key || !this.freqs[key]) return;

				this.playNote(key);
				e.preventDefault();
			});

			btn.addEventListener(
				'touchstart',
				(e) => {
					const key = btn.dataset.note;
					if (!key || !this.freqs[key]) return;

					this.playNote(key);
					e.preventDefault();
				},
				true
			);

			/* change button while clicked */
			btn.addEventListener('mouseenter', (e) => {
				const key = btn.dataset.note;
				if (!e.buttons || !key || !this.freqs[key]) return;

				this.playNote(key);
				e.preventDefault();
			});

			/* release button */
			btn.addEventListener('mouseup', (e) => {
				const key = btn.dataset.note;
				if (!key || !this.freqs[key] || !this.nodes[key]) return;

				this.endNote(this.nodes[key]);
				e.preventDefault();
			});

			btn.addEventListener('mouseout', (e) => {
				const key = btn.dataset.note;
				if (!key || !this.freqs[key] || !this.nodes[key]) return;

				this.endNote(this.nodes[key]);
				e.preventDefault();
			});

			btn.addEventListener('touchend', (e) => {
				const key = btn.dataset.note;
				if (!key || !this.freqs[key] || !this.nodes[key]) return;

				this.endNote(this.nodes[key]);
				e.preventDefault();
			});

			btn.addEventListener('touchcancel', (e) => {
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
			this.decay = parseInt(data.decay) / 1000 + 0.001;
			this.release = parseInt(data.release) / 1000 + 0.1;
			this.pitch = parseInt(data.pitch) + 3;
			this.drawWave();
			this.drawAdsr();
		};

		this.controls.addEventListener('change', () => {
			applyOptions();
		});

		applyOptions();
	}

	drawWave() {
		const waveDiagrams = this.headerDiagram.querySelectorAll(
			'[id^="wave"]'
		);
		waveDiagrams.forEach((waveDiagram) => {
			waveDiagram.toggleAttribute(
				'hidden',
				waveDiagram.id !== `wave-${this.wave}`
			);
		});
	}

	drawAdsr() {
		const a = this.headerDiagram.querySelector('#adsr-a');
		const d = this.headerDiagram.querySelector('#adsr-d');
		const s = this.headerDiagram.querySelector('#adsr-s');
		const r = this.headerDiagram.querySelector('#adsr-r');

		const ax = (this.attack - 0.01) * 100;
		a.toggleAttribute('hidden', ax === 0);
		a.setAttribute('x2', ax);
		d.setAttribute('x1', ax);

		const dx = (this.decay - 0.001) * 100 + ax;
		const dy = dx - ax === 0 ? 0 : 100;
		d.toggleAttribute('hidden', dx === 0);
		d.setAttribute('x2', dx);
		s.setAttribute('x1', dx);

		const rx = 400 - (this.release - 0.1) * 10;
		r.toggleAttribute('hidden', rx === 400);
		s.setAttribute('x2', rx);
		r.setAttribute('x1', rx);
	}
}

new Synth();

window.onload = () => {
	'use strict';

	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('./serviceworker.js');
	}
};
