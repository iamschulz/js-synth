import { test, expect } from "@playwright/test";
import { getNodes, sleep } from "../helpers";

test("key controls", async ({ page }) => {
	await page.goto("/");
	await sleep(100);

	await page.keyboard.down("KeyQ");
	await expect(await getNodes(page)).toStrictEqual(["c2"]);

	await page.keyboard.down("KeyE");
	await expect(await getNodes(page)).toStrictEqual(["c2", "d2"]);

	await page.keyboard.up("KeyQ");
	await expect(await getNodes(page)).toStrictEqual(["d2"]);
});
