import { test, expect } from "@playwright/test";
import { sleep } from "../helpers";

test("key controls", async ({ page, browserName }) => {
	if (browserName === "firefox") {
		return; // todo: fix handles for firefox
	}

	const logs: string[] = [];
	page.on("console", (msg) => {
		const text = msg.text();
		text.startsWith("test:") && logs.push(text);
	});

	await page.goto("/");
	await sleep(1000);

	await page.keyboard.down("KeyQ");
	await page.evaluate(() => console.log("test:", window.Synth.nodes));
	await expect(logs[0]).toContain("c2: ");

	await page.keyboard.down("KeyE");
	await page.evaluate(() => console.log("test:", window.Synth.nodes));
	await expect(logs[1]).toContain("c2: ");
	await expect(logs[1]).toContain("d2: ");

	await page.keyboard.up("KeyQ");
	await page.evaluate(() => console.log("test:", window.Synth.nodes));
	await expect(logs[2]).not.toContain("c2: ");
	await expect(logs[2]).toContain("d2: ");
});
