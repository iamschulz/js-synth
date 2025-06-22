import { Page } from "@playwright/test";

export function sleep(time: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, time));
}

export async function getActiveNotes(page: Page): Promise<Object> {
	const windowHandle = await page.evaluateHandle(() => window);
	const resultHandle = await page.evaluateHandle((window) => window.Main.activeNotes, windowHandle);
	const result = await resultHandle.jsonValue();
	await resultHandle.dispose();
	return result;
}
