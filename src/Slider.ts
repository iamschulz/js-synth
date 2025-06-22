export class Slider {
	el: HTMLDivElement;
	prevBtn: HTMLButtonElement;
	nextBtn: HTMLButtonElement;
	changeCallback: (el: HTMLElement) => void;

	constructor(changeCallback: (el: HTMLElement) => void) {
		this.el = document.querySelector(".controls-slider")!;
		this.prevBtn = document.querySelector("#prev") as HTMLButtonElement;
		this.nextBtn = document.querySelector("#next") as HTMLButtonElement;
		this.changeCallback = changeCallback;

		this.registerSliderControls();
		this.updateButtons();
		this.restoreSliderPosition();
	}

	restoreSliderPosition(): void {
		window.requestAnimationFrame(() => {
			this.el.scrollLeft = parseInt(localStorage.getItem("slider-position") || "0");
		});
	}

	getActiveElement(): HTMLElement | null {
		const activeSynth = Array.from(document.querySelectorAll(".controls-slider .synth-controls")).find((el) => {
			const rect = (el as HTMLElement).getBoundingClientRect();
			return rect.left >= 0 && rect.right <= window.innerWidth;
		}) as HTMLFormElement;
		if (!activeSynth) {
			return null; // no active synth to remove
		}
		return activeSynth;
	}

	registerSliderControls(): void {
		this.el.addEventListener("scroll", this.onSliderScroll.bind(this));

		this.prevBtn.addEventListener("click", () => {
			const target = this.getActiveElement()?.previousElementSibling;
			if (!target) {
				return;
			}
			this.animateScrollSliderToTarget(target as HTMLElement);
		});
		this.nextBtn.addEventListener("click", () => {
			const target = this.getActiveElement()?.nextElementSibling;
			if (!target) {
				return;
			}
			this.animateScrollSliderToTarget(target as HTMLElement);
		});
	}

	onSliderScroll(): void {
		localStorage.setItem("slider-position", this.el.scrollLeft.toString());

		const targetElement = Array.from(this.el.children).find(
			(item) => (item as HTMLElement).offsetLeft - this.el.scrollLeft > 0
		) as HTMLElement;
		if (!targetElement) {
			return; // no target element to update
		}

		window.requestAnimationFrame(() => {
			this.updateButtons();
			this.changeCallback(targetElement);
		});
	}

	updateButtons(): void {
		const isLeft = this.el.scrollLeft <= 50;
		const isRight = this.el.scrollLeft + this.el.clientWidth >= this.el.scrollWidth - 50;
		this.prevBtn.disabled = isLeft;
		this.nextBtn.disabled = isRight;
	}

	animateScrollSliderToTarget(el: HTMLElement): void {
		this.el.style.scrollSnapType = "none"; // Disable scroll snapping for smooth animation

		const position = -8 + el.offsetLeft + el.clientWidth / 2 - this.el.clientWidth / 2; // Center the target element in the slider
		const start = this.el.scrollLeft;
		const distance = position - start;
		const duration = 500; // duration in milliseconds
		const startTime = performance.now();
		const animateScroll = (currentTime: number) => {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1); // Ensure progress does not exceed 1
			const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t); // Easing function

			this.el.scrollLeft = start + distance * easeInOutQuad(progress);

			if (progress < 1) {
				window.requestAnimationFrame(animateScroll);
			} else {
				this.el.style.scrollSnapType = "x mandatory"; // Re-enable scroll snapping after animation
			}
		};

		window.requestAnimationFrame(animateScroll);
	}
}
