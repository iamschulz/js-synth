import { test, expect, Page } from "@playwright/test";
import { sleep } from "../helpers";

const getPitchBend = (page: Page): Promise<number> => page.evaluate(() => window.Main.pitchBend);

/* returns false when the synth swallowed the scroll instead of letting the page scroll */
const scroll = (page: Page, deltaY: number, deltaX = 0): Promise<boolean> =>
	page.evaluate(
		([deltaY, deltaX]) =>
			document.body.dispatchEvent(
				new WheelEvent("wheel", { deltaY, deltaX, bubbles: true, cancelable: true })
			),
		[deltaY, deltaX]
	);

test("pitch wheel", async ({ page }) => {
	await page.goto("/");
	await sleep(500);

	/* no held note, so the page scrolls as usual */
	await expect(await scroll(page, -100)).toBe(true);
	await expect(await getPitchBend(page)).toBe(0.5);

	await page.keyboard.down("KeyQ");

	/* scrolling up bends up, scrolling down bends below center */
	await expect(await scroll(page, -100)).toBe(false);
	await expect(await getPitchBend(page)).toBeGreaterThan(0.5);

	await scroll(page, 300);
	await expect(await getPitchBend(page)).toBeLessThan(0.5);

	/* the bend is clamped to the full range */
	await scroll(page, -10000);
	await expect(await getPitchBend(page)).toBe(1);

	/* a sideways scroll belongs to the synth slider, not the pitch wheel */
	await expect(await scroll(page, -5, 200)).toBe(true);
	await expect(await getPitchBend(page)).toBe(1);

	/* releasing the key springs the wheel back to center */
	await page.keyboard.up("KeyQ");
	await expect(await getPitchBend(page)).toBe(0.5);
});

test("pitch wheel locks page scrolling", async ({ page, browserName, isMobile }) => {
	test.skip(browserName === "webkit" && !!isMobile, "mobile WebKit has no mouse wheel to drive");

	await page.setViewportSize({ width: 800, height: 400 }); // small enough for the page to scroll
	await page.goto("/");
	await sleep(500);
	await page.mouse.move(400, 200);

	const state = () =>
		page.evaluate(() => ({
			scrollY: window.scrollY,
			right: document.body.getBoundingClientRect().right,
		}));

	/* no held note, so the page scrolls as usual */
	await page.mouse.wheel(0, 100);
	await sleep(300);
	const unlocked = await state();
	await expect(unlocked.scrollY).toBe(100);

	await page.keyboard.down("KeyQ");

	/* the wheel bends the pitch and leaves the page where it is */
	await page.mouse.wheel(0, 200);
	await sleep(300);
	const bending = await state();
	await expect(bending.scrollY).toBe(100);
	await expect(await getPitchBend(page)).toBeLessThan(0.5);

	/* hiding the scrollbar must not shove the layout sideways */
	await expect(bending.right).toBe(unlocked.right);

	/* a gesture already rolling gives us events we can't cancel, and still can't scroll */
	await page.evaluate(() =>
		document.body.dispatchEvent(
			new WheelEvent("wheel", { deltaY: 300, bubbles: true, cancelable: false })
		)
	);
	await sleep(300);
	await expect((await state()).scrollY).toBe(100);

	/* releasing the key hands scrolling back to the page */
	await page.keyboard.up("KeyQ");
	await page.mouse.wheel(0, 100);
	await sleep(300);
	await expect((await state()).scrollY).toBe(200);
});
