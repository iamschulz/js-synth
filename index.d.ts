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

	/* the lib types leave out the maplike half of AudioParamMap */
	interface AudioParamMap extends ReadonlyMap<string, AudioParam> {}
}
