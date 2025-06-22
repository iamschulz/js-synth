import { test, expect, Locator } from "@playwright/test";
import { sleep } from "../helpers";

test("slider", async ({ page }) => {
	await page.goto("/");
	await sleep(500);

	const countSliderChildren = async () => {
		return await page.locator("css=.controls-slider").locator("css=> *").count();
	};

	const getScrollValue = async (locator: Locator) => {
		return await locator.evaluate((el) => {
			return el.scrollLeft;
		});
	};

	const slider = await page.locator("css=.controls-slider");
	const addBtn = await page.locator("css=#add-synth");
	const remBtn = await page.locator("css=#remove-synth");
	const prevBtn = await page.locator("css=#prev");
	const nextBtn = await page.locator("css=#next");

	// default state, 1 synth
	await sleep(1000);
	await expect(await remBtn.isDisabled()).toBeTruthy();
	await expect(await prevBtn.isDisabled()).toBeTruthy();
	await expect(await nextBtn.isDisabled()).toBeTruthy();
	await expect(await countSliderChildren()).toStrictEqual(1);
	await expect(await getScrollValue(slider)).toBe(0); // slider not scrolled

	// add 2nd synth
	await addBtn.click();
	await sleep(1000);
	await expect(await remBtn.isDisabled()).toBeFalsy();
	await expect(await prevBtn.isDisabled()).toBeFalsy();
	await expect(await nextBtn.isDisabled()).toBeTruthy();
	await expect(await countSliderChildren()).toStrictEqual(2);
	await expect(await getScrollValue(slider)).toBeGreaterThan(0); // slider scrolled

	// scroll to 1st synth
	await prevBtn.click();
	await sleep(1000);
	await expect(await prevBtn.isDisabled()).toBeTruthy();
	await expect(await nextBtn.isDisabled()).toBeFalsy();
	await expect(await getScrollValue(slider)).toBe(0); // slider not scrolled

	// scroll to 2nd synth
	await nextBtn.click();
	await sleep(1000);
	await expect(await prevBtn.isDisabled()).toBeFalsy();
	await expect(await nextBtn.isDisabled()).toBeTruthy();
	await expect(await getScrollValue(slider)).toBeGreaterThan(0); // slider scrolled

	// remove 2nd synth
	await remBtn.click();
	await sleep(1000);
	await expect(await remBtn.isDisabled()).toBeTruthy();
	await expect(await prevBtn.isDisabled()).toBeTruthy();
	await expect(await nextBtn.isDisabled()).toBeTruthy();
	await expect(await getScrollValue(slider)).toBe(0); // slider not scrolled
});
