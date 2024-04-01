import { test, expect } from "@playwright/test";
import { sleep } from "../helpers";

test("virtual-keyboard", async ({ page, browserName }) => {
	if (browserName === "firefox") {
		return; // fix handles for firefox
	}

	const logs: string[] = [];
	page.on("console", (msg) => {
		const text = msg.text();
		text.startsWith("test:") && logs.push(text);
	});

	await page.goto("/");
	await sleep(1000);

	await page.getByRole("button", { name: "z" }).dispatchEvent("mousedown");
	await page.evaluate(() => console.log("test:", window.Synth.nodes));
	await expect(logs[0]).toContain("f2: ");

	await page.getByRole("button", { name: "u" }).dispatchEvent("mousedown");
	await page.evaluate(() => console.log("test:", window.Synth.nodes));
	await expect(logs[1]).toContain("f2: ");
	await expect(logs[1]).toContain("fs2: ");

	await page.getByRole("button", { name: "z" }).dispatchEvent("mouseup");
	await page.evaluate(() => console.log("test:", window.Synth.nodes));
	await expect(logs[2]).toContain("fs2: ");
	await expect(logs[2]).not.toContain("f2: ");
});
