import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Read-only browser checks. No forms are submitted and no accounts are changed.
const baseURL = process.env.LANDING_URL ?? "http://127.0.0.1:3000";
const output = process.env.LANDING_SCREENSHOTS ?? "/tmp/senso-landing-review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const errors = [];
try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto(baseURL, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(await page.locator("main > section").count(), 9);
    const overflow = await page.evaluate(() => document.body.scrollWidth - innerWidth);
    assert.ok(overflow <= 1, `Page overflows at ${width}px: ${overflow}`);
    const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    assert.deepEqual(accessibility.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), []);
    await page.screenshot({ path: `${output}/${width}.png`, fullPage: true });
    await page.screenshot({ path: `${output}/${width}-hero.png` });
    for (const id of ["discover", "evaluate", "verify", "activate", "measure", "intelligence"]) {
      assert.equal(await page.locator(`#${id}`).count(), 1);
    }
    console.log(`${width}px: HTTP 200, content, containment and axe passed`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL);
  const choices = page.locator('[aria-label="Preview creators"] button');
  if (await choices.count() > 1) {
    await choices.nth(1).click();
    assert.equal(await choices.nth(1).getAttribute("aria-pressed"), "true");
  }
  await page.getByRole("textbox", { name: "Search preview creators" }).fill("no-such-preview-creator-123");
  assert.equal(await page.getByRole("status").isVisible(), true);
  await page.getByRole("textbox", { name: "Search preview creators" }).fill("");
  assert.ok(await choices.count() > 0);
  const confidence = page.getByRole("button", { name: "Confidence", exact: true });
  await confidence.click();
  assert.equal(await confidence.getAttribute("aria-pressed"), "true");
  assert.equal(await page.getByRole("img", { name: /^Data confidence:/ }).count(), 1);
  const health = page.getByRole("button", { name: "Health", exact: true });
  await health.click();
  assert.equal(await health.getAttribute("aria-pressed"), "true");
  assert.equal(await page.getByRole("img", { name: /^Creator health:/ }).count(), 1);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const disclosure of await page.locator("main details:visible").all()) {
      await disclosure.locator("summary").click();
    }
    const expandedAudit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    assert.deepEqual(expandedAudit.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), []);
    assert.ok(await page.evaluate(() => document.body.scrollWidth - innerWidth) <= 1);
    for (const disclosure of await page.locator("main details:visible").all()) {
      await disclosure.locator("summary").click();
    }
  }
  console.log("Creator selection, search/empty/reset, health/confidence chart toggle, expanded detail accessibility and containment passed");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL);
  await page.getByRole("button", { name: "Open navigation" }).click();
  assert.equal(await page.getByRole("navigation", { name: "Mobile" }).isVisible(), true);
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("navigation", { name: "Mobile" }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Open navigation" }).evaluate(el => el === document.activeElement), true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Evaluate" }).click();
  await page.waitForURL(/#evaluate$/);
  assert.equal(await page.getByRole("navigation", { name: "Mobile" }).count(), 0);
  for (const route of ["/pricing", "/login", "/register"]) {
    const response = await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200, route);
    console.log(`${route}: HTTP 200`);
  }
  await page.goto(baseURL);
  await page.getByRole("link", { name: "Start free", exact: true }).first().click();
  await page.waitForURL(/\/register$/);
  assert.deepEqual(errors, []);
  const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const staticPage = await noJS.newPage();
  await staticPage.goto(baseURL);
  assert.equal(await staticPage.locator("h1").isVisible(), true);
  assert.equal(await staticPage.locator("#discover h2").evaluate(el => getComputedStyle(el.parentElement).opacity), "1");
  await noJS.close();
  console.log(`Mobile disclosure, Escape/focus, anchor navigation, registration CTA, no-JS content, and zero browser exceptions passed. Screenshots: ${output}`);
} finally { await browser.close(); }
