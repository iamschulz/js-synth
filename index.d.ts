export {};

declare global {
	interface Window {
		Main: Object;
	}

	interface Navigator {
		keyboard: {
			getLayoutMap: () => Promise<{
				get: (string) => string;
			}>;
		};
	}
}
