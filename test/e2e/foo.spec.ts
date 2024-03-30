import { test, expect } from "@playwright/test";
import { sleep } from "../helpers";

test("foo", async ({ page }) => {
	await page.goto("/");
	await sleep(200);

	await expect(page.locator(".keyboard")).toBeTruthy();
});
