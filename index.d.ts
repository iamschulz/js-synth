import { Main } from "./src/script";

declare global {
	interface Window {
		Main: Main;
	}

	interface Navigator {
		keyboard: {
			getLayoutMap: () => Promise<{
				get: (string) => string;
			}>;
		};
	}
}
