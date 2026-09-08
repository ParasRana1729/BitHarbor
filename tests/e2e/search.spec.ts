import { expect, test } from "@playwright/test";

/**
 * Core production flows against a real build + live providers.
 * Queries are deliberately varied so tests exercise all five feeds.
 */

test.describe("search", () => {
  test("homepage renders brand, categories and prompt", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".brand")).toHaveText("~/bitharbor");
    await expect(page.locator(".pill")).toHaveCount(8);
    await expect(page.locator(".chip")).toHaveCount(5);
    await expect(page.locator(".prompt input")).toBeVisible();
  });

  test("movie search returns ranked results with download actions", async ({ page }) => {
    await page.goto("/");
    await page.locator(".pill", { hasText: "Movies" }).click();
    await page.locator(".prompt input").fill("dune");
    await page.locator(".prompt button").click();
    await expect(page.locator(".meta").first()).toContainText("results ·", { timeout: 60000 });
    const cards = page.locator('[data-testid="result"]');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(5);

    const first = cards.first();
    await expect(first.locator(".title")).not.toBeEmpty();
    const seeders = Number(await first.getAttribute("data-seeders"));
    expect(seeders).toBeGreaterThanOrEqual(0);
    // at least one result offers a magnet link
    await expect(page.locator('.card a[href^="magnet:"]').first()).toBeVisible();
  });

  test("anime search is nyaa-driven", async ({ page }) => {
    await page.goto("/");
    await page.locator(".pill", { hasText: "Anime" }).click();
    await page.locator(".prompt input").fill("one piece");
    await page.keyboard.press("Enter");
    await expect(page.locator(".meta").first()).toContainText("results ·", { timeout: 60000 });
    const srcs = await page.locator(".card .src").allTextContents();
    expect(srcs.length).toBeGreaterThan(0);
    expect(srcs.every((s) => s === "nyaa" || s === "solid")).toBe(true);
  });

  test("tv search includes eztv episode results", async ({ page }) => {
    await page.goto("/");
    await page.locator(".pill", { hasText: "TV Shows" }).click();
    await page.locator(".prompt input").fill("severance");
    await page.locator(".prompt button").click();
    await expect(page.locator(".meta").first()).toContainText("results ·", { timeout: 90000 });
    const srcs = await page.locator(".card .src").allTextContents();
    expect(srcs).toContain("eztv");
  });

  test("short query keeps search disabled", async ({ page }) => {
    await page.goto("/");
    await page.locator(".prompt input").fill("x");
    await expect(page.locator(".prompt button")).toBeDisabled();
  });

  test("api rejects bad category and tracker", async ({ request }) => {
    const badCat = await request.get("/api/search?q=test&cat=nope");
    expect(badCat.status()).toBe(400);
    const badTracker = await request.get("/api/search?q=test&trackers=1337x");
    expect(badTracker.status()).toBe(400);
  });

  test("health reports providers and categories", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.providers).toEqual(expect.arrayContaining(["nyaa", "yts", "tpb", "solid", "eztv"]));
    expect(body.categories).toContain("anime");
  });
});
