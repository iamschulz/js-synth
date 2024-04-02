import { test, expect } from "@playwright/test";
import { getNodes, sleep } from "../helpers";

test("virtual-keyboard", async ({ page }) => {
	await page.goto("/");
	await sleep(100);

	await page.getByRole("button", { name: "z" }).dispatchEvent("mousedown");
	await expect(await getNodes(page)).toStrictEqual(["f2"]);

	await page.getByRole("button", { name: "u" }).dispatchEvent("mousedown");
	await expect(await getNodes(page)).toStrictEqual(["f2", "fs2"]);

	await page.getByRole("button", { name: "z" }).dispatchEvent("mouseup");
	await expect(await getNodes(page)).toStrictEqual(["fs2"]);
});
