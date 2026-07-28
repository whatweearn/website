import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The funnel, end to end.
 *
 * These exist because the things that lose respondents are the ones unit tests
 * cannot see: a draft that does not survive a refresh, a Next button that
 * stays disabled, a progress bar that lies about how much is left.
 */

/**
 * Gives a test its own identity before it submits.
 *
 * The server treats one address and browser as one person for the day, so
 * every test in this suite was the *same* person: the first submission was
 * stored and the rest were silently discarded as duplicates. That was
 * invisible while a duplicate saw the same confirmation as everybody else, so
 * most of these assertions were running against an answer the server had
 * thrown away. It also held the suite at the five-per-hour rate limit, which
 * is why tests were being bundled together to save submissions.
 *
 * Overriding the header rather than building a context with a different user
 * agent, because the mobile project's page *is* the device emulation and a
 * fresh context would quietly drop it. The dedup handle is computed from the
 * request header, so this is the part that has to differ; the project name is
 * in the tag because both projects run against one server.
 */
async function identify(page: Page, tag: string) {
  await page.setExtraHTTPHeaders({
    "user-agent": `whatweearn-e2e/${test.info().project.name}-${tag}`,
  });
}

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

test.describe("city on the first screen", () => {
  /**
   * Eleven countries once had no hubs recorded, so the select offered exactly
   * one option — "Elsewhere" — beneath a hint asking the respondent to pick the
   * nearest. A form that visibly does not work, on the first screen, before
   * anyone has invested anything in finishing it.
   */
  test("offers real hubs for a country that once had none", async ({ page }) => {
    await page.goto("/survey");
    await page.getByLabel("Country").selectOption("GR");

    const city = page.getByLabel("City");
    await expect(city.getByRole("option", { name: "Athens" })).toBeAttached();
    await expect(city.getByRole("option", { name: "Thessaloniki" })).toBeAttached();
  });

  test("never leaves the catch-all as the only choice", async ({ page }) => {
    await page.goto("/survey");
    for (const code of ["LV", "SI", "UA", "EE"]) {
      await page.getByLabel("Country").selectOption(code);
      const options = page.getByLabel("City").getByRole("option");
      expect(await options.count(), `${code} offers only the catch-all`).toBeGreaterThan(1);
    }
  });
});

test.describe("contract type in local terms", () => {
  /**
   * The categories are generic; the boundary that decides whether a response
   * reaches a headline median is drawn by local law under local names. Someone
   * on an umowa zlecenie is not an employee, but "Fixed-term employee" reads
   * like a fair description of it — and choosing that puts a non-employee gross
   * figure into the employees-only median, where nothing downstream can catch
   * it. Unit tests cover the mapping; this covers the wiring, which is the part
   * that silently breaks.
   */
  test("names the contract the way the respondent's own payslip does", async ({ page }) => {
    await page.goto("/survey");
    await page.getByLabel("Country").selectOption("PL");
    await next(page);
    await next(page);

    await expect(page.getByText("Umowa o pracę na czas nieokreślony")).toBeVisible();
    await expect(page.getByText("Kontrakt B2B (JDG)")).toBeVisible();
  });

  test("follows the country when it is changed", async ({ page }) => {
    await page.goto("/survey");
    await page.getByLabel("Country").selectOption("PL");
    await next(page);
    await next(page);
    await expect(page.getByText("Kontrakt B2B (JDG)")).toBeVisible();

    await page.getByRole("button", { name: /^Back/ }).click();
    await page.getByRole("button", { name: /^Back/ }).click();
    await page.getByLabel("Country").selectOption("DE");
    // Both screens ahead are already answered, so returning to them is one
    // click labelled "Continue", not two more "Next"s.
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Über eine eigene GmbH oder UG")).toBeVisible();
    await expect(page.getByText("Kontrakt B2B (JDG)")).toHaveCount(0);
  });

  test("falls back to the generic wording for a country with no terms recorded", async ({
    page,
  }) => {
    // Switzerland has three working languages; picking one would mislead the
    // speakers of the other two, so it stays generic by design.
    await page.goto("/survey");
    await page.getByLabel("Country").selectOption("CH");
    await next(page);
    await next(page);

    await expect(page.getByText("Company-to-company, through your own business")).toBeVisible();
  });

  test("stores the same answer whatever language it was read in", async ({ page }) => {
    // The label is what the funnel selects on, and it must not move: a
    // localised *value* would fragment every cut in the site by language.
    await page.goto("/survey");
    await page.getByLabel("Country").selectOption("PL");
    await next(page);
    await next(page);

    await expect(page.getByText("Permanent employee")).toBeVisible();
    await expect(page.getByText("B2B", { exact: true })).toBeVisible();
  });
});

test.describe("survey funnel", () => {
  test("walks all nine questions and submits, accepting the default currency", async ({
    page,
  }) => {
    await identify(page, "funnel");
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

  test("returns to the submit screen in one click after fixing a flagged answer", async ({
    page,
  }) => {
    await identify(page, "flagged");
    // Gating each step makes this unreachable through ordinary clicking (see
    // above), so the missing answer is seeded directly — the safety net this
    // exercises is for whatever gets a respondent here regardless.
    await page.goto("/survey");
    await page.evaluate(() => {
      localStorage.setItem(
        "wwe-draft",
        JSON.stringify({
          country: "DE",
          contractType: "permanent",
          baseSalary: 78000,
          salaryPeriod: "year",
          currency: "EUR",
          __step: 8,
          __furthestStep: 8,
        }),
      );
    });
    await page.reload();

    await expect(page.getByText("Question 9 of 9")).toBeVisible();
    const submit = page.getByRole("button", { name: "Submit" });
    await expect(submit).toBeEnabled({ timeout: 20_000 });
    await submit.click();

    // Sent back to answer the missing level, not told to go find it.
    await expect(page.getByText("Question 5 of 9")).toBeVisible();
    await page.getByText("Senior", { exact: true }).click();

    // One click, not four "Next"s, back to where submission was attempted.
    await page.getByRole("button", { name: "Continue to submit" }).click();
    await expect(page.getByText("Question 9 of 9")).toBeVisible();
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
    // Pre-publication, the honest state is a named empty state — not a zero,
    // and certainly not a placeholder figure.
    await expect(page.getByText("No distribution yet")).toBeVisible();
    await expect(page.getByText("Not enough answers yet")).toBeVisible();

    // This used to assert that "engineers have answered" appeared nowhere,
    // which conflated "nothing has published" with "nobody has answered".
    // They are different states, and the gap between them is where the site
    // now lives: real responses, no figures yet. A true response count is
    // deliberately shown once it exists. What must never appear before
    // publication is a *figure*, so that is what is asserted instead.
    //
    // A money amount, not the word "median" — that appears throughout the
    // copy explaining why nothing is published, which is the honesty working
    // rather than a leak.
    const body = (await page.locator("body").innerText()).replace(/ /g, " ");
    expect(body, "a currency figure appeared before anything published").not.toMatch(
      /€\s?\d/,
    );
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
    await expect(
      page.getByRole("heading", { name: /What engineers earn, and what contractors charge/ }),
    ).toBeVisible();
    await expect(page.getByText(/Nothing is published yet/)).toBeVisible();
  });

  test("keeps the filters usable with no data behind them", async ({ page }) => {
    // An explorer that throws or blanks when a slice is empty is worse than
    // one that says "nobody here yet" — which is also a recruiting message.
    await page.goto("/data");
    await page.getByRole("button", { name: /Employees, full-time/ }).click();
    await page.getByLabel("Country").selectOption("PT");
    await page.getByLabel("Level").selectOption("senior");
    await expect(page.getByText(/Nobody here yet|Not enough answers here yet/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Add yours/ })).toBeVisible();
  });

  test("asks which group before showing a figure, rather than defaulting to employees", async ({
    page,
  }) => {
    // Half the answers this survey receives are contractors. A page that
    // opens on employee salaries and files everyone else below tells them
    // which half the site is for.
    await page.goto("/data");
    for (const name of [/Employees, full-time/, /Employees, part-time/, /Contractors and B2B/]) {
      await expect(page.getByRole("button", { name })).toBeVisible();
    }
    await expect(page.getByLabel("Country")).toHaveCount(0);

    await page.getByRole("button", { name: /Contractors and B2B/ }).click();
    await expect(page.getByLabel("Who")).toHaveValue("contractor");
    await expect(page.getByLabel("Country")).toBeVisible();
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

test.describe("the screens a contractor is shown", () => {
  /**
   * Two whole screens and a field were asked of contractors and then ignored:
   * nobody invoices themselves a bonus, equity is not what a client pays, and
   * `populationOf` returns "contractor" before it ever reads a full-time
   * percentage. Their published figure is a day rate, base only.
   */
  async function reachContract(page: Page, contract: string) {
    await page.goto("/survey");
    await page.getByLabel("Country").selectOption("FR");
    await next(page);
    await next(page);
    await page.getByText(contract).click();
  }

  test("asks a contractor seven questions and an employee nine", async ({ page }) => {
    await reachContract(page, "Contractor / freelance");
    await expect(page.getByText("Question 3 of 7")).toBeVisible();

    await page.getByText("Permanent employee").click();
    await expect(page.getByText("Question 3 of 9")).toBeVisible();
  });

  test("does not ask a contractor for a full-time percentage", async ({ page }) => {
    await reachContract(page, "Contractor / freelance");
    await expect(page.getByLabel("Hours")).toHaveCount(0);

    await page.getByText("Permanent employee").click();
    await expect(page.getByLabel("Hours")).toBeVisible();
  });

  test("takes a contractor from their rate to submitting, with no bonus or equity", async ({
    page,
  }) => {
    await reachContract(page, "Contractor / freelance");
    await next(page);
    await next(page);
    await page.getByText("Senior", { exact: true }).click();
    await next(page);
    await page.getByRole("spinbutton").first().fill("650");
    await next(page);

    // Straight to the last screen: the two skipped ones are not merely blank.
    await expect(page.getByRole("heading", { name: "About the client" })).toBeVisible();
    await expect(page.getByText("Question 7 of 7")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit" })).toBeVisible();
  });

  test("survives switching contract after passing the screens that then vanish", async ({
    page,
  }) => {
    // The saved position can outlive the screen it pointed at. An employee who
    // reaches equity, goes back and switches to contracting has a stored step
    // that no longer exists.
    await page.goto("/survey");
    await page.evaluate(() => {
      localStorage.setItem(
        "wwe-draft",
        JSON.stringify({
          country: "FR",
          contractType: "permanent",
          level: "senior",
          baseSalary: 78000,
          bonus: 5000,
          equityAnnual: 1000,
          ftePercent: 80,
          __step: 7,
          __furthestStep: 8,
        }),
      );
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Any equity?" })).toBeVisible();

    const contractScreen = page.getByRole("heading", { name: "What kind of contract?" });
    while (!(await contractScreen.isVisible())) {
      await page.getByRole("button", { name: /^Back/ }).click();
    }
    await page.getByText("Contractor / freelance").click();

    // Clamped to a screen that exists, rather than rendering nothing.
    await expect(page.getByText("Question 3 of 7")).toBeVisible();
    await page.getByRole("button", { name: /Continue|^Next/ }).click();
    await expect(page.getByText(/Question \d of 7/)).toBeVisible();
  });
});

test.describe("pay adjusted for where you live", () => {
  const QUESTION = "Is your pay adjusted for where you live?";

  async function reachSetup(page: Page) {
    await page.goto("/survey");
    await page.getByLabel("Country").selectOption("DE");
    await next(page);
    await expect(page.getByRole("heading", { name: "How do you work?" })).toBeVisible();
  }

  /**
   * On-site and hybrid both mean living within commuting distance, so the
   * question is either tautological or a comment on the employer's banding —
   * two incompatible readings landing in one boolean column, on the majority
   * of respondents. City is asked on screen 1 and carries their geography.
   */
  test("is asked only of people whose employer is somewhere they are not", async ({ page }) => {
    await reachSetup(page);
    await expect(page.getByText(QUESTION)).toHaveCount(0);

    for (const setup of ["On-site", "Hybrid"]) {
      await page.getByText(setup, { exact: true }).click();
      await expect(page.getByText(QUESTION), `${setup} was asked`).toHaveCount(0);
    }

    for (const setup of ["Remote, same country", "Remote, another country"]) {
      await page.getByText(setup).click();
      await expect(page.getByText(QUESTION), `${setup} was not asked`).toBeVisible();
    }
  });

  /**
   * The draft outlives the answer that reveals the question, and this field
   * reaches the published CSV. Answer it as a remote worker, go back to
   * on-site, and the boolean would otherwise be submitted from a question no
   * longer on the screen — recorded against somebody who cannot see or correct
   * it.
   */
  test("does not submit an answer given before switching to on-site", async ({ page }) => {
    await identify(page, "location-adjusted");
    await reachSetup(page);

    await page.getByText("Remote, another country").click();
    await page.getByRole("group", { name: QUESTION }).getByText("Yes").click();
    await page.getByText("On-site", { exact: true }).click();
    await expect(page.getByText(QUESTION)).toHaveCount(0);

    const posted = page.waitForRequest(
      (request) => request.url().includes("/api/response") && request.method() === "POST",
    );

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

    const { response } = JSON.parse((await posted).postData() ?? "{}");
    expect(response.workSetup).toBe("onsite");
    expect(response).not.toHaveProperty("payLocationAdjusted");
  });
});

test.describe("pay quoted per day", () => {
  test("lets a freelancer answer in the unit they think in, and nothing else", async ({
    page,
  }) => {
    // The population this exists for: a freelancer who thinks in a day rate
    // and has no idea what their "annual salary" is. They now type one number
    // and move on — the period is already right, and the billed-days count
    // that used to block them was only ever needed to annualise, which their
    // published figure no longer does.
    await page.goto("/survey");
    await page.getByLabel("Country").selectOption("FR");
    await next(page);
    await next(page);
    await page.getByText("Contractor / freelance").click();
    await next(page);
    await next(page);
    await page.getByText("Senior", { exact: true }).click();
    await next(page);

    await expect(page.getByLabel("Pay period")).toHaveValue("day");
    await page.getByRole("spinbutton").first().fill("650");
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
  async function reachSalary(
    page: Page,
    country: string,
    contract: "Permanent employee" | "Contractor / freelance" = "Permanent employee",
  ) {
    await page.goto("/survey");
    await page.getByLabel("Country").selectOption(country);
    await next(page);
    await next(page);
    await page.getByText(contract).click();
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

  test("starts a contractor on a day rate and an employee on a year", async ({ page }) => {
    // The two groups think in different units, and it is also the unit each
    // one's figures are published in. Getting this wrong silently stores a
    // €650 day rate as a €650 salary, so the default has to be submitted and
    // not merely displayed.
    await reachSalary(page, "FR", "Contractor / freelance");
    await expect(page.getByLabel("Pay period")).toHaveValue("day");

    // The draft would otherwise resume this run at question six, where there
    // is no country select to answer.
    await page.evaluate(() => localStorage.clear());
    await reachSalary(page, "FR");
    await expect(page.getByLabel("Pay period")).toHaveValue("year");
  });

  test("does not make a contractor count the days they billed", async ({ page }) => {
    // Their rate is published as a price at a standard year, so the count was
    // a required question whose answer we then ignored.
    await reachSalary(page, "FR", "Contractor / freelance");
    await page.getByRole("spinbutton").first().fill("650");

    await expect(page.getByText(/Optional\. Rates publish at a standard 220-day year/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Next/ })).toBeEnabled();
  });

  test("still asks an employee for the days behind a day rate", async ({ page }) => {
    // Theirs is annualised into a year's income, where the days worked belong.
    await reachSalary(page, "FR");
    await page.getByRole("spinbutton").first().fill("650");
    await page.getByLabel("Pay period").selectOption("day");

    await expect(page.getByRole("button", { name: /^Next/ })).toBeDisabled();
    await page.getByLabel(/Days you billed/).fill("210");
    await expect(page.getByRole("button", { name: /^Next/ })).toBeEnabled();
  });

  test("still refuses a day rate that is impossible at any working year", async ({ page }) => {
    // Dropping the required count must not drop the typo check with it.
    await reachSalary(page, "FR", "Contractor / freelance");
    await page.getByRole("spinbutton").first().fill("650000");

    await expect(page.getByText(/works out to about/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Next/ })).toBeDisabled();
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
  /** Walks the survey and submits. `contract` decides which figures it joins. */
  async function submitFrom(
    page: Page,
    country: string,
    contract: "Permanent employee" | "Contractor / freelance" = "Permanent employee",
  ) {
    await page.goto("/survey");
    await page.getByLabel("Country").selectOption(country);
    await next(page);
    await next(page);
    await page.getByText(contract).click();
    await next(page);
    await next(page);
    await page.getByText("Senior", { exact: true }).click();
    await next(page);

    if (contract === "Contractor / freelance") {
      // No period to choose and no billed days to fill: both are the point of
      // the assertions in "the salary screen" below.
      await page.getByRole("spinbutton").first().fill("650");
    } else {
      await page.getByRole("spinbutton").first().fill("78000");
    }

    // A contractor is not asked about a bonus or equity, so there are two
    // fewer screens between the rate and the end.
    await next(page);
    if (contract !== "Contractor / freelance") {
      await next(page);
      await next(page);
    }
    const submit = page.getByRole("button", { name: "Submit" });
    await expect(submit).toBeEnabled({ timeout: 20_000 });
    await submit.click();
    await expect(page.getByRole("heading", { name: /That.s in/ })).toBeVisible({ timeout: 20_000 });
  }

  test("shows how close that country is to publishing", async ({ page }) => {
    // The most valuable moment in the funnel: someone has just spent two
    // minutes and feels good about it. A dead end here wastes it.
    await identify(page, "progress");
    await submitFrom(page, "DE");
    await expect(page.getByText(/engineer from Germany/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/more and Germany.s median publishes/)).toBeVisible();
  });

  /**
   * Half the answers this survey receives are contractors, and this screen
   * used to tell the first one from a country that they were its 0th engineer:
   * it read them a count they were never in.
   */
  test("places a contractor among contractors, against their own threshold", async ({ page }) => {
    await identify(page, "contractor");
    await submitFrom(page, "FR", "Contractor / freelance");

    await expect(page.getByText(/contractor from France/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/0th/)).toHaveCount(0);
    await expect(page.getByText(/more and France.s contractor day rates publish/)).toBeVisible();
    // And the message they are handed names the gap they can actually close.
    await expect(page.getByText(/more contractor day rates/)).toBeVisible();
  });

  test("says plainly when an answer was not the one kept", async ({ page }) => {
    await identify(page, "duplicate");
    await submitFrom(page, "ES");
    // Same browser, same day: the first answer stands and this one is dropped.
    await submitFrom(page, "ES").catch(() => {});
    await expect(page.getByRole("heading", { name: /Already counted/ })).toBeVisible();
    await expect(page.getByText(/already had an answer from this browser today/)).toBeVisible();
  });

  test("offers the email inline rather than sending people elsewhere", async ({ page }) => {
    await identify(page, "email");
    await submitFrom(page, "NL");
    await expect(page.getByLabel(/Email me when results publish/)).toBeVisible();
    await expect(page.getByText(/never email you about your own numbers/)).toBeVisible();
  });

  // One submission, several assertions. Splitting these into a test each is
  // tidier to read and pushes the block past the five-per-hour rate limit,
  // which is a production rule worth more than the tidiness.
  test("makes sharing the obvious next move", async ({ page, context }) => {
    await identify(page, "sharing");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await submitFrom(page, "DE");
    await expect(page.getByText(/engineer from Germany/)).toBeVisible({ timeout: 15_000 });

    // Shown, not hidden behind the button. People post what they can read; a
    // bare copy button asks somebody to publish text under their own name
    // sight unseen, which is most of why share buttons go unclicked.
    const share = page.getByRole("region", { name: /decides whether Germany|pass it on/i });
    await expect(
      share.getByText(/Germany needs \d+ more before any of us can see what it really pays/),
    ).toBeVisible();

    // Every channel one click away, and all of them plain links. A share SDK
    // would be both a CSP violation and exactly the tracking this site
    // promises it does not load.
    for (const name of [
      /Share on X/,
      /Share on LinkedIn/,
      /Post to Reddit/,
      /Send on WhatsApp/,
      /Share by email/,
    ]) {
      await expect(share.getByRole("link", { name })).toBeVisible();
    }
    const scripts = await page.evaluate(() =>
      [...document.querySelectorAll("script[src]")].map((s) => (s as HTMLScriptElement).src),
    );
    const origin = new URL(page.url()).origin;
    const external = scripts
      .filter((src) => !src.startsWith(origin))
      .filter((src) => !src.includes("challenges.cloudflare.com"));
    expect(external).toEqual([]);

    await share.getByRole("button", { name: /Copy the message/ }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    // Addressed to whoever receives it, and offering them the number. Naming a
    // country they have no stake in, or asking them to help us reach sixty,
    // are both things nobody forwards. The link has to travel with it too.
    expect(copied).toMatch(/Germany needs \d+ more before any of us can see what it really pays/);
    expect(copied).toMatch(/https?:\/\//);

    // Scanned here rather than in a11y.spec.ts, which would have to complete a
    // tenth submission to reach this screen and push the suite over the
    // five-per-hour rate limit. This screen had never been checked, and the
    // last audit found the light palette failing contrast on tokens nobody had
    // measured — so an unscanned screen is not a safe assumption here.
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important}" });
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations, `${theme} theme`).toEqual([]);
    }
  });


  test("keeps the deletion caveat, but not as the headline", async ({ page }) => {
    await identify(page, "caveat");
    await submitFrom(page, "ES");
    const heading = await page.getByRole("heading", { name: /That.s in/ }).textContent();
    expect(heading).not.toMatch(/cannot/i);
    // Still said — just not the first thing at the moment of most goodwill.
    await expect(page.getByText(/cannot take one particular response back out/)).toBeVisible();
    // And said once. The warning shown while the decision can still be changed
    // belongs to the questions, so it goes with them; leaving it on the page
    // shell stacked it directly above the confirmation's own version.
    await expect(page.getByText(/we cannot delete one particular response/)).toHaveCount(0);
  });

  test("warns before submitting, where the warning can still change a decision", async ({
    page,
  }) => {
    await page.goto("/survey");
    await expect(page.getByText(/we cannot delete one particular response/)).toBeVisible();
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

  /**
   * The widget must mount once and stay mounted.
   *
   * It did not. `onToken` and `onFailure` were inline arrows in the wizard, so
   * they changed identity on every render, and they sat in the Turnstile
   * effect's dependency array — which meant every keystroke and every answer
   * removed the widget and rendered a new one. Production measured nineteen
   * render/remove pairs from six interactions on one screen.
   *
   * That is not a tidiness problem. Each remount asks Cloudflare for a fresh
   * challenge, so one person filling in nine screens looked like dozens of
   * challenge requests against a single sitekey — the shape of the abuse
   * Turnstile exists to throttle. It also discarded any token already solved,
   * wiped an interaction-only checkbox the moment the next answer was given,
   * and restarted the give-up timer so the failure notice fired at random.
   * The visible symptom is a site that appears to have Cloudflare blocked.
   */
  test("mounts the widget once, however many answers are given", async ({ page }) => {
    // Every `turnstile.render()` mints a widget with a fresh `cf-chl-widget-*`
    // id, so counting the distinct ids that have ever existed counts mounts —
    // and unlike patching the Turnstile object, it survives however api.js
    // chooses to define itself.
    await page.addInitScript(() => {
      const ids: string[] = [];
      (window as unknown as { __widgetIds: string[] }).__widgetIds = ids;
      const seen = new Set<string>();
      const scan = () => {
        for (const field of document.querySelectorAll<HTMLInputElement>(
          'input[name="cf-turnstile-response"]',
        )) {
          if (field.id && !seen.has(field.id)) {
            seen.add(field.id);
            ids.push(field.id);
          }
        }
      };
      new MutationObserver(scan).observe(document, { childList: true, subtree: true });
      scan();
    });

    const widgetIds = () =>
      page.evaluate(() => (window as unknown as { __widgetIds: string[] }).__widgetIds);

    await page.goto("/survey");
    await expect.poll(async () => (await widgetIds()).length).toBeGreaterThan(0);

    // Six answers on the first screen alone, then the rest of the funnel.
    for (const code of ["BE", "DE", "ES", "FR", "IT", "NL"]) {
      await page.getByLabel("Country").selectOption(code);
    }
    await next(page);
    await next(page);
    await page.getByText("Permanent employee").click();
    await next(page);
    await next(page);
    await page.getByText("Senior", { exact: true }).click();
    await next(page);
    await page.getByRole("spinbutton").first().fill("78000");
    await next(page);

    // One id, not one per answer given.
    expect(await widgetIds()).toHaveLength(1);
  });
});

test.describe("the share card's two actions", () => {
  // Exercised through the landing page's card rather than the confirmation
  // screen's. They are the same component, and the survey funnel already sits
  // at the five-submissions-per-hour rate limit — a test that needs no
  // submission should not spend one.
  const cancels = {
    name: "the visitor backs out of the sheet",
    script: () => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: () => Promise.reject(new DOMException("cancelled", "AbortError")),
      });
    },
  };

  test("cancelling the native share sheet does nothing at all", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(cancels.script);
    await page.goto("/");
    await page.evaluate(() => navigator.clipboard.writeText("untouched"));

    const share = page.getByRole("region", { name: /send it to someone/i });
    await share.getByRole("button", { name: "Share it" }).click();

    // Dismissing used to fall through to copying, so backing out put text on
    // the clipboard and announced "Copied" — an action nobody asked for,
    // reported as a success.
    await expect(share.getByRole("button", { name: "Copied" })).toHaveCount(0);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("untouched");
  });

  test("names what each button does, with no 'instead'", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(cancels.script);
    await page.goto("/");
    const share = page.getByRole("region", { name: /send it to someone/i });

    await share.getByRole("button", { name: "Copy the message" }).click();
    await expect(share.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/whatweearn/);
    // The share button must not narrate a copy it did not perform.
    await expect(share.getByRole("button", { name: "Share it" })).toBeVisible();
  });

  test("copy is the only action where no share sheet exists", async ({ page }) => {
    // Desktop browsers with no navigator.share: one button, still named.
    await page.goto("/");
    const share = page.getByRole("region", { name: /send it to someone/i });
    await expect(share.getByRole("button", { name: "Copy the message" })).toBeVisible();
    await expect(share.getByRole("button", { name: "Share it" })).toHaveCount(0);
  });
});

test("buttons sitting in the same row are the same height", async ({ page }) => {
  // The hero's filled + ghost pair is the same shape as the share card's, and
  // both were mismatched: a ghost button's border sits outside the padding box
  // at `height: auto`, so it stood 2px taller than the filled one beside it.
  // Cheap to reintroduce by hand-rolling one control's padding, so it is
  // measured rather than trusted.
  await page.goto("/");
  const heights = await page
    .locator("#cta-hero, #cta-hero ~ a")
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
  expect(heights.length).toBeGreaterThan(1);
  expect(new Set(heights).size, `heights were ${heights.join(", ")}`).toBe(1);
});

test.describe("the promise matches reality", () => {
  test("does not claim the dataset opens when nothing has published", async ({ page }) => {
    // The hero promised "the whole dataset opens the moment you're done" while
    // /data showed empty states — false for exactly the first few hundred
    // people, whose goodwill this project depends on.
    await page.goto("/");
    await expect(page.getByText(/opens the moment/)).toHaveCount(0);
    await expect(page.getByText(/Nothing is published yet/)).toBeVisible();
  });

  test("makes being early the offer instead", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/the early ones count for most/)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /It opens for everyone, the moment there is enough/ }),
    ).toBeVisible();
  });

  test("keeps metadata true in either state", async ({ page }) => {
    // Crawlers cache this, so it cannot be conditional on today's data.
    await page.goto("/");
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description).not.toMatch(/opens the moment/);
  });
});
