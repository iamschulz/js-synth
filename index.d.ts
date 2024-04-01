export {};

declare global {
	interface Window {
		Synth: {
			nodes: Object;
		};
	}

	interface Navigator {
		keyboard: {
			getLayoutMap: () => Promise<{
				get: (string) => string;
			}>;
		};
	}
}
