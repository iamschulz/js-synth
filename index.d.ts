export {};

declare global {
	interface Navigator {
		keyboard: {
			getLayoutMap: () => Promise<{
				get: (string) => string;
			}>;
		};
	}
}
