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
    await expect(page.getByRole("heading", { name: /That.s in/ })).toBeVisible({
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

test.describe("the notification list", () => {
  test("offers the email on the data page, not inside the survey", async ({ page }) => {
    // The two requests being minutes apart, from different pages, to
    // different databases, is much of what makes "never linked" true.
    await page.goto("/survey");
    await expect(page.getByLabel(/Email me when results publish/)).toHaveCount(0);

    await page.goto("/data");
    await expect(page.getByLabel(/Email me when results publish/)).toBeVisible();
  });

  test("says plainly what it cannot do", async ({ page }) => {
    await page.goto("/data");
    await expect(page.getByText(/never email you about your own numbers/)).toBeVisible();
  });

  test("rejects a malformed address without contacting the server", async ({ page }) => {
    await page.goto("/data");
    await page.getByLabel(/Email me when results publish/).fill("not-an-email");
    await page.getByRole("button", { name: /Notify me/ }).click();
    // Native validation blocks it; nothing is sent and no error page appears.
    await expect(page.getByText(/Check your inbox/)).toHaveCount(0);
  });

  test("explains a broken confirmation link instead of failing silently", async ({ page }) => {
    await page.goto("/subscribed?state=invalid");
    await expect(page.getByRole("heading", { name: /didn.t work/ })).toBeVisible();
  });

  test("confirms without leaking whether the address was already on the list", async ({ page }) => {
    await page.goto("/subscribed?state=confirmed");
    await expect(page.getByRole("heading", { name: /on the list/ })).toBeVisible();
    await expect(page.getByText(/never about your own answers/)).toBeVisible();
  });
});

test.describe("pay quoted per day", () => {
  test("asks for the multiplier and will not proceed without it", async ({ page }) => {
    // The population this exists for: a freelancer who thinks in a day rate and
    // has no idea what their "annual salary" is.
    await page.goto("/survey");
    await page.getByLabel("Country").selectOption("FR");
    await next(page);
    await next(page);
    await page.getByText("Contractor / freelance").click();
    await next(page);
    await next(page);
    await page.getByText("Senior", { exact: true }).click();
    await next(page);

    await page.getByRole("spinbutton").first().fill("650");
    // 650 a year is not a salary, and the sanity check says so.
    await expect(page.getByRole("button", { name: /^Next/ })).toBeDisabled();

    await page.getByLabel("Pay period").selectOption("day");
    await expect(page.getByLabel(/Days you billed/)).toBeVisible();
    // Still blocked: annualising on a guessed working year would swing the
    // figure by 15%, so the count is required rather than assumed.
    await expect(page.getByRole("button", { name: /^Next/ })).toBeDisabled();

    await page.getByLabel(/Days you billed/).fill("210");
    await expect(page.getByRole("button", { name: /^Next/ })).toBeEnabled();
  });

  test("leaves an annual salary exactly as it was", async ({ page }) => {
    // Progressive disclosure: an employee must see no extra questions.
    await page.goto("/survey");
    await page.getByLabel("Country").selectOption("DE");
    await next(page);
    await next(page);
    await page.getByText("Permanent employee").click();
    await next(page);
    await next(page);
    await page.getByText("Senior", { exact: true }).click();
    await next(page);

    await page.getByRole("spinbutton").first().fill("78000");
    await expect(page.getByLabel(/Days you billed/)).toHaveCount(0);
    await expect(page.getByLabel(/Hours you billed/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Next/ })).toBeEnabled();
  });
});

test.describe("salary sanity checks", () => {
  async function reachSalary(page: Page, country: string) {
    await page.goto("/survey");
    await page.getByLabel("Country").selectOption(country);
    await next(page);
    await next(page);
    await page.getByText("Permanent employee").click();
    await next(page);
    await next(page);
    await page.getByText("Senior", { exact: true }).click();
    await next(page);
  }

  test("blocks an obviously impossible figure and says why", async ({ page }) => {
    await reachSalary(page, "DE");
    await page.getByRole("spinbutton").first().fill("200");

    await expect(page.getByText(/works out to about/)).toBeVisible();
    // Caught on the screen that asks, not after eight more questions.
    await expect(page.getByRole("button", { name: /^Next/ })).toBeDisabled();
  });

  test("clears once the figure is corrected", async ({ page }) => {
    await reachSalary(page, "DE");
    await page.getByRole("spinbutton").first().fill("200");
    await expect(page.getByRole("button", { name: /^Next/ })).toBeDisabled();

    await page.getByRole("spinbutton").first().fill("78000");
    await expect(page.getByText(/works out to about/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Next/ })).toBeEnabled();
  });

  test("warns about an unusual figure but still lets it through", async ({ page }) => {
    // The lowest-paid junior and the highest-paid principal are both real
    // people whose answers we want.
    await reachSalary(page, "DE");
    await page.getByRole("spinbutton").first().fill("600000");

    await expect(page.getByText(/very high/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Next/ })).toBeEnabled();
  });

  test("judges by converted value, not the raw number", async ({ page }) => {
    // 12,000,000 forint is an ordinary Hungarian salary. A euro-scale
    // threshold would have waved through nonsense and blocked this.
    await reachSalary(page, "HU");
    await page.getByRole("spinbutton").first().fill("12000000");

    await expect(page.getByText(/works out to about/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Next/ })).toBeEnabled();
  });

  test("accepts a day rate that would be impossible as a yearly figure", async ({ page }) => {
    await reachSalary(page, "FR");
    await page.getByRole("spinbutton").first().fill("650");
    await page.getByLabel("Pay period").selectOption("day");
    await page.getByLabel(/Days you billed/).fill("210");

    await expect(page.getByText(/works out to about/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Next/ })).toBeEnabled();
  });
});

test.describe("the confirmation screen", () => {
  async function submitFrom(page: Page, country: string) {
    await page.goto("/survey");
    await page.getByLabel("Country").selectOption(country);
    await next(page);
    await next(page);
    await page.getByText("Permanent employee").click();
    await next(page);
    await next(page);
    await page.getByText("Senior", { exact: true }).click();
    await next(page);
    await page.getByRole("spinbutton").first().fill("78000");
    await next(page);
    await next(page);
    await next(page);
    const submit = page.getByRole("button", { name: "Submit" });
    await expect(submit).toBeEnabled({ timeout: 20_000 });
    await submit.click();
    await expect(page.getByRole("heading", { name: /That.s in/ })).toBeVisible({ timeout: 20_000 });
  }

  test("shows how close that country is to publishing", async ({ page }) => {
    // The most valuable moment in the funnel: someone has just spent two
    // minutes and feels good about it. A dead end here wastes it.
    await submitFrom(page, "DE");
    await expect(page.getByText(/engineer from Germany/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/more and Germany.s median publishes/)).toBeVisible();
  });

  test("offers the email inline rather than sending people elsewhere", async ({ page }) => {
    await submitFrom(page, "NL");
    await expect(page.getByLabel(/Email me when results publish/)).toBeVisible();
    await expect(page.getByText(/never email you about your own numbers/)).toBeVisible();
  });

  test("offers a share carrying the gap, not an achievement", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await submitFrom(page, "DE");
    await expect(page.getByText(/engineer from Germany/)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /Ask someone else/ }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    // "Germany needs N more" makes the reader's action consequential; "I did a
    // survey" asks for a favour.
    expect(copied).toMatch(/Germany needs \d+ more before its median publishes/);
  });

  test("keeps the deletion caveat, but not as the headline", async ({ page }) => {
    await submitFrom(page, "ES");
    const heading = await page.getByRole("heading", { name: /That.s in/ }).textContent();
    expect(heading).not.toMatch(/cannot/i);
    // Still said — just not the first thing at the moment of most goodwill.
    await expect(page.getByText(/cannot take one particular response back out/)).toBeVisible();
  });
});

test.describe("legal pages", () => {
  test("identifies the operator, as Belgian and German law require", async ({ page }) => {
    await page.goto("/imprint");
    await expect(page.getByText("Codeetry SRL", { exact: true })).toBeVisible();
    await expect(page.getByText("privacy@whatweearn.eu")).toBeVisible();
    await expect(page.getByText(/0880\.250\.749/)).toBeVisible();
    // The alert only clears once a controller is genuinely configured.
    await expect(page.getByText(/not ready to collect data/)).toHaveCount(0);
  });

  test("names a controller and a supervisory authority on the privacy page", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByText("Codeetry SRL")).toBeVisible();
    // GDPR Article 13: people must be told the right to complain exists, and
    // to whom — not merely that they have rights in the abstract.
    await expect(page.getByText(/Belgian Data Protection Authority/)).toBeVisible();
    await expect(page.getByText(/not ready to collect data/)).toHaveCount(0);
  });

  test("links the imprint from every page footer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Imprint" })).toBeVisible();
  });
});

test.describe("when the browser check cannot run", () => {
  test("explains rather than hanging on a disabled button", async ({ page, context }) => {
    // Blocking Cloudflare reproduces what a privacy extension does. Before
    // this, the button sat on "Checking your browser…" forever with no
    // explanation and no way out.
    await context.route("https://challenges.cloudflare.com/**", (route) => route.abort());

    await page.goto("/survey");
    await page.getByLabel("Country").selectOption("BE");
    await next(page);
    await next(page);
    await page.getByText("Permanent employee").click();
    await next(page);
    await next(page);
    await page.getByText("Senior", { exact: true }).click();
    await next(page);
    await page.getByRole("spinbutton").first().fill("72000");
    await next(page);
    await next(page);
    await next(page);

    await expect(page.getByText(/could not check your browser/i)).toBeVisible({ timeout: 25_000 });
    await expect(page.getByRole("button", { name: /Try the check again/ })).toBeVisible();
    // Their answers are still on screen; nothing was lost.
    await expect(page.getByText("Question 9 of 9")).toBeVisible();
  });
});
