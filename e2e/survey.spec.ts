import { expect, test, type Page } from "@playwright/test";

/**
 * The funnel, end to end.
 *
 * These exist because the things that lose respondents are the ones unit tests
 * cannot see: a draft that does not survive a refresh, a Next button that
 * stays disabled, a progress bar that lies about how much is left.
 */

async function next(page: Page) {
  await page.getByRole("button", { name: /^Next/ }).click();
}

async function answerRequired(page: Page) {
  await page.getByLabel("Country").selectOption("DE");
  await next(page);

  await next(page); // work setup — optional

  await page.getByText("Permanent employee").click();
  await next(page);

  await next(page); // role — optional

  await page.getByText("Senior", { exact: true }).click();
  await next(page);

  await page.getByRole("spinbutton").first().fill("78000");
}

test.describe("survey funnel", () => {
  test("walks all nine questions and submits, accepting the default currency", async ({
    page,
  }) => {
    await page.goto("/survey");

    await expect(page.getByText("Question 1 of 9")).toBeVisible();
    await answerRequired(page);

    // Remaining optional screens.
    for (let i = 0; i < 3; i++) await next(page);

    await expect(page.getByText("Question 9 of 9")).toBeVisible();
    // Enabled only once Turnstile has produced a token.
    const submit = page.getByRole("button", { name: "Submit" });
    await expect(submit).toBeEnabled({ timeout: 20_000 });
    await submit.click();

    // Never touching the currency select must still submit: the country's
    // default is shown as an answer, so it has to behave like one.
    await expect(page.getByRole("heading", { name: /Thank you/ })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("will not let you leave the salary question unanswered", async ({ page }) => {
    await page.goto("/survey");
    await page.getByLabel("Country").selectOption("DE");
    await next(page);
    await next(page);
    await page.getByText("Permanent employee").click();
    await next(page);
    await next(page);
    await page.getByText("Senior", { exact: true }).click();
    await next(page);

    // Gating each step is what makes a "you missed something" screen at the
    // very end unreachable — far better than recovering from one.
    await expect(page.getByText("Question 6 of 9")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Next/ })).toBeDisabled();
    await page.getByRole("spinbutton").first().fill("78000");
    await expect(page.getByRole("button", { name: /^Next/ })).toBeEnabled();
  });

  test("keeps Next disabled until a required answer is given", async ({ page }) => {
    await page.goto("/survey");
    const nextButton = page.getByRole("button", { name: /^Next/ });

    await expect(nextButton).toBeDisabled();
    await page.getByLabel("Country").selectOption("PL");
    await expect(nextButton).toBeEnabled();
  });

  test("survives a reload without losing answers", async ({ page }) => {
    await page.goto("/survey");
    await page.getByLabel("Country").selectOption("ES");
    await next(page);

    await page.reload();

    // Drafts live in localStorage, which is also why we can honestly tell
    // someone with an expired form that reloading costs them nothing. Both the
    // answers and the place in the survey come back.
    await expect(page.getByText("Question 2 of 9")).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByLabel("Country")).toHaveValue("ES");
  });

  test("starts at question 2 when the landing page already knows two answers", async ({
    page,
  }) => {
    await page.goto("/survey?country=NL&level=staff");

    // The pre-fill is the point of the segmenter: a survey that visibly starts
    // partly answered is a different proposition from one that starts at zero.
    await expect(page.getByText("Question 2 of 9")).toBeVisible();
  });

  test("advances the progress bar as questions are answered", async ({ page }) => {
    await page.goto("/survey");
    const bar = page.getByRole("progressbar");

    await expect(bar).toHaveAttribute("aria-valuenow", "1");
    await page.getByLabel("Country").selectOption("IE");
    await next(page);
    await expect(bar).toHaveAttribute("aria-valuenow", "2");
  });

  test("never exposes the honeypot to a person", async ({ page }) => {
    await page.goto("/survey");
    await expect(page.locator("#website")).not.toBeInViewport();
  });
});

test.describe("landing page", () => {
  test("says so plainly when there is nothing to publish", async ({ page }) => {
    await page.goto("/");
    // Pre-launch, the honest state is a named empty state — not a zero, and
    // certainly not a placeholder figure.
    await expect(page.getByText("No distribution yet")).toBeVisible();
    await expect(page.getByText(/engineers have answered/)).toHaveCount(0);
  });

  test("routes the hero call to action into the survey", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Add your salary/ }).first().click();
    await expect(page).toHaveURL(/\/survey/);
    await expect(page.getByText("Question 1 of 9")).toBeVisible();
  });
});

test.describe("the data page", () => {
  test("renders honestly before any data exists", async ({ page }) => {
    await page.goto("/data");
    await expect(page.getByRole("heading", { name: "What engineers earn." })).toBeVisible();
    await expect(page.getByText(/Nothing is published yet/)).toBeVisible();
  });

  test("keeps the filters usable with no data behind them", async ({ page }) => {
    // An explorer that throws or blanks when a slice is empty is worse than
    // one that says "nobody here yet" — which is also a recruiting message.
    await page.goto("/data");
    await page.getByLabel("Country").selectOption("PT");
    await page.getByLabel("Level").selectOption("senior");
    await expect(page.getByText(/Nobody here yet|Not enough answers here yet/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Add yours/ })).toBeVisible();
  });

  test("offers no download until there are rows to release", async ({ page }) => {
    await page.goto("/data");
    await expect(page.getByRole("link", { name: /Download CSV/ })).toHaveCount(0);
    await expect(page.getByText(/download appears once/i)).toBeVisible();
  });

  test("is reachable from the landing page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "See the data first" }).click();
    await expect(page).toHaveURL(/\/data$/);
  });
});
