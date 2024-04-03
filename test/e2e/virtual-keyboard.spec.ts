import { test, expect } from "@playwright/test";
import { getNodes, sleep } from "../helpers";

test("virtual-keyboard", async ({ page }) => {
	await page.goto("/");
	await sleep(500);

	await page.locator('css=button[data-note="g2"]').dispatchEvent("mousedown");
	await expect(await getNodes(page)).toStrictEqual(["g2"]);

	await page.locator('css=button[data-note="fs2"]').dispatchEvent("mousedown");
	await expect(await getNodes(page)).toStrictEqual(["g2", "fs2"]);

	await page.locator('css=button[data-note="g2"]').dispatchEvent("mouseup");
	await expect(await getNodes(page)).toStrictEqual(["fs2"]);
});
