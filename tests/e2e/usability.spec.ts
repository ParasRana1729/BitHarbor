import { expect, test, type Page } from "@playwright/test";

/**
 * Usability at production scale: theme, keyboard, sorting, subtitles,
 * mobile layout, and a clean console — the things unit tests can't see.
 */

async function search(page: Page, query: string, category = "Movies") {
  await page.goto("/");
  await page.locator(".pill", { hasText: category }).click();
  await page.locator(".prompt input").fill(query);
  await page.locator(".prompt button").click();
  await expect(page.locator(".meta").first()).toContainText("results ·", { timeout: 60000 });
}

test.describe("usability", () => {
  test("theme toggle flips theme and persists across reload", async ({ page }) => {
    await page.goto("/");
    const toggle = page.locator(".theme-toggle");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("pressing / focuses the search box", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("/");
    await expect(page.locator(".prompt input")).toBeFocused();
  });

  test("sort select actually reorders results", async ({ page }) => {
    await search(page, "dune");
    const sizes = async () =>
      (await page.locator('[data-testid="result"]').evaluateAll((els) =>
        els.map((e) => Number((e as HTMLElement).dataset.size)),
      )) as number[];
    await page.locator(".sort select").selectOption("biggest");
    const desc = await sizes();
    expect(desc.length).toBeGreaterThan(3);
    for (let i = 1; i < Math.min(desc.length, 10); i++) {
      expect(desc[i - 1]).toBeGreaterThanOrEqual(desc[i]);
    }
    await page.locator(".sort select").selectOption("newest");
    const dates = (await page
      .locator('[data-testid="result"]')
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.published))) as string[];
    for (let i = 1; i < Math.min(dates.length, 10); i++) {
      expect(+new Date(dates[i - 1])).toBeGreaterThanOrEqual(+new Date(dates[i]));
    }
  });

  test("subtitle button opens matched downloads", async ({ page }) => {
    await search(page, "the matrix");
    const btn = page.locator(".card", { hasText: "The Matrix (1999)" }).locator("button", { hasText: "subtitles" }).first();
    await btn.click();
    const panel = page.locator(".subs-panel").first();
    await expect(panel).toBeVisible({ timeout: 60000 });
    const dl = panel.locator('a[href$=".zip"]').first();
    await expect(dl).toBeVisible({ timeout: 60000 });
    expect(await dl.getAttribute("href")).toContain("yifysubtitles.ch/subtitle/");
  });

  test("provider chips narrow the result set", async ({ page }) => {
    await page.goto("/");
    await page.locator(".chip", { hasText: "YTS" }).click();
    await page.locator(".chip", { hasText: "Nyaa" }).click();
    await page.locator(".chip", { hasText: "Pirate Bay" }).click();
    await page.locator(".chip", { hasText: "Solid" }).click();
    await page.locator(".chip", { hasText: "EZTV" }).click();
    // unchecking all resets to all-on
    await expect(page.locator(".chip.active")).toHaveCount(5);
    // only eztv on
    for (const label of ["Nyaa", "YTS", "Pirate Bay", "Solid"]) {
      await page.locator(".chip", { hasText: label }).click();
    }
    await page.locator(".pill", { hasText: "TV Shows" }).click();
    await page.locator(".prompt input").fill("severance");
    await page.locator(".prompt button").click();
    await expect(page.locator(".meta").first()).toContainText("results ·", { timeout: 90000 });
    const srcs = await page.locator(".card .src").allTextContents();
    expect(srcs.length).toBeGreaterThan(0);
    expect(new Set(srcs)).toEqual(new Set(["eztv"]));
  });

  test("mobile layout stays usable", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator(".prompt input")).toBeVisible();
    await page.locator(".pill", { hasText: "Books" }).click();
    await page.locator(".prompt input").fill("dune");
    await page.locator(".prompt button").click();
    await expect(page.locator(".meta").first()).toContainText("results ·", { timeout: 60000 });
    await expect(page.locator('[data-testid="result"]').first()).toBeVisible();
    await context.close();
  });

  test("no page errors or console errors during search", async ({ page }) => {
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`console: ${m.text()}`);
    });
    await search(page, "ubuntu", "Software");
    expect(problems).toEqual([]);
  });
});
