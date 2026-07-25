import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Accessibility, checked rather than claimed.
 *
 * Automated rules catch perhaps a third of real barriers, so passing this is a
 * floor and not a certificate. It does reliably catch the things this project
 * has already got wrong once — every form control was unlabelled until the
 * Playwright suite could not find them either.
 *
 * Both themes are checked. Contrast failures hide in whichever one the author
 * does not use.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(TAGS).analyze();
}

/**
 * Switching theme starts a colour transition on every element that has one.
 * Scanning during it makes axe measure blended intermediate colours and report
 * failures that no visitor ever sees, so transitions are disabled first —
 * which is also exactly what a reduced-motion visitor gets.
 */
async function settle(page: Page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      transition: none !important;
      animation: none !important;
    }`,
  });
  await page.evaluate(() => new Promise(requestAnimationFrame));
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate((value) => {
    document.documentElement.setAttribute("data-theme", value);
  }, theme);
  await settle(page);
}

const PAGES = [
  ["landing", "/"],
  ["survey", "/survey"],
  ["data", "/data"],
  ["methodology", "/methodology"],
  ["privacy", "/privacy"],
] as const;

for (const [name, path] of PAGES) {
  for (const theme of ["light", "dark"] as const) {
    test(`${name} page has no accessibility violations in ${theme}`, async ({ page }) => {
      await page.goto(path);
      await setTheme(page, theme);
      const results = await scan(page);

      // Report what failed, not just how many.
      expect(
        results.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.help}`),
      ).toEqual([]);
    });
  }
}

test("the survey stays accessible on every question", async ({ page }) => {
  // The wizard replaces its whole content between steps, so a violation on
  // question seven would never appear in a scan of question one.
  test.setTimeout(120_000);

  await page.goto("/survey");
  await settle(page);

  // Answering is keyed to the step that asks, rather than trying every control
  // and swallowing the failures — speculative clicks each wait out the full
  // action timeout on the steps where they do not apply.
  const answer: Record<number, () => Promise<void>> = {
    1: async () => {
      await page.getByLabel("Country").selectOption("DE");
    },
    3: async () => page.getByText("Permanent employee").click(),
    5: async () => page.getByText("Senior", { exact: true }).click(),
    6: async () => page.getByRole("spinbutton").first().fill("70000"),
  };

  for (let question = 1; question <= 9; question++) {
    await answer[question]?.();
    await settle(page);

    const results = await scan(page);
    expect(
      results.violations.map((v) => `question ${question}: ${v.id} — ${v.help}`),
    ).toEqual([]);

    if (question < 9) await page.getByRole("button", { name: /^Next/ }).click();
  }
});

test("keyboard focus is always visible", async ({ page }) => {
  await page.goto("/");
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return "none";
      const style = getComputedStyle(el);
      return `${style.outlineStyle} ${style.outlineWidth}`;
    });
    // A focus ring that is invisible is the same as no focus ring.
    expect(outline).not.toBe("none 0px");
  }
});

test("the page is usable at 200% zoom without horizontal scrolling", async ({ page }) => {
  // WCAG 2.2 reflow: 320 CSS pixels of width at 400% of a 1280px viewport.
  await page.setViewportSize({ width: 320, height: 720 });
  for (const [, path] of PAGES) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${path} scrolls sideways at 320px`).toBeLessThanOrEqual(0);
  }
});
