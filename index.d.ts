export {};

declare global {
	interface Window {
		Main: {
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
