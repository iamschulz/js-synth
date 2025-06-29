export class Slider {
	el: HTMLDivElement;
	activeItem: HTMLElement;
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

		Array.from(this.el.children).forEach((item) => {
			this.registerIntersectionObserver(item as HTMLElement);
		});
		this.registerMutationObserver();
	}

	registerMutationObserver() {
		const options = { childList: true };

		const callback = (mutationList: MutationRecord[]) => {
			for (const mutation of mutationList) {
				if (mutation.type !== "childList") {
					return;
				}

				Array.from(mutation.addedNodes).forEach((item: HTMLElement) => {
					this.registerIntersectionObserver(item);
				});
			}
		};

		const observer = new MutationObserver(callback);
		observer.observe(this.el, options);
	}

	registerIntersectionObserver(el: HTMLElement) {
		const options = {
			root: this.el,
			rootMargin: "0px",
			threshold: 1.0,
		};

		const callback = (items: IntersectionObserverEntry[]) => {
			const activeItem = Array.from(items).find((x) => x.isIntersecting)?.target as HTMLElement | null;
			if (!activeItem) {
				return;
			}
			this.activeItem = activeItem;

			localStorage.setItem("slider-position", this.el.scrollLeft.toString());

			window.requestAnimationFrame(() => {
				this.updateButtons();
				this.changeCallback(this.activeItem);
			});
		};

		const observer = new IntersectionObserver(callback, options);
		observer.observe(el);
	}

	restoreSliderPosition(): void {
		window.requestAnimationFrame(() => {
			this.el.scrollLeft = parseInt(localStorage.getItem("slider-position") || "0");
		});
	}

	registerSliderControls(): void {
		this.prevBtn.addEventListener("click", () => {
			this.animateScrollSliderToTarget(this.activeItem.previousSibling as HTMLElement);
		});
		this.nextBtn.addEventListener("click", () => {
			this.animateScrollSliderToTarget(this.activeItem.nextSibling as HTMLElement);
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

		const itemWidth = el.clientWidth;
		const position = el.offsetLeft - this.el.offsetLeft + itemWidth / 2 - this.el.clientWidth / 2; // Center the target element in the slider
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
