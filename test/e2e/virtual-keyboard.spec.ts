import { test, expect } from "@playwright/test";
import { getNodes, sleep } from "../helpers";

test("virtual-keyboard", async ({ page }) => {
	await page.goto("/");
	await sleep(500);

	await page.getByRole("button", { name: "i" }).dispatchEvent("mousedown");
	await expect(await getNodes(page)).toStrictEqual(["g2"]);

	await page.getByRole("button", { name: "u" }).dispatchEvent("mousedown");
	await expect(await getNodes(page)).toStrictEqual(["g2", "fs2"]);

	await page.getByRole("button", { name: "i" }).dispatchEvent("mouseup");
	await expect(await getNodes(page)).toStrictEqual(["fs2"]);
});
