import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type Page, expect, test } from "./fixtures";

/** English first: visiting a prefixed page saves its language, which "/" would reopen. */
const LOCALES = ["en", "es", "pt", "fr", "de"] as const;

type Locale = (typeof LOCALES)[number];

function homePath(locale: Locale) {
  return locale === "en" ? "/" : `/${locale}`;
}

async function readHtmlLang(page: Page) {
  return page.evaluate(() => document.documentElement.lang);
}

/** Opens the home page in `locale`, checks it renders in it, and returns its h1. */
async function readHomeHeading(page: Page, locale: Locale) {
  await page.goto(homePath(locale));

  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(2);
  expect(await readHtmlLang(page)).toBe(locale);

  return heading.textContent();
}

test.describe("Home page for visitors", () => {
  test("renders and translates the page in every language", async ({ page }) => {
    const headings: Partial<Record<Locale, string | null>> = {};

    for (const locale of LOCALES) {
      // oxlint-disable-next-line no-await-in-loop -- One page opens each language in turn.
      headings[locale] = await readHomeHeading(page, locale);
    }

    expect(headings.en).toContain("Get ready for");
    expect(headings.pt).not.toBe(headings.en);
  });

  test("never suggests learning the language the page is written in", async ({ page }) => {
    await page.goto("/es");
    await expect(page.locator("main [lang='en']")).toHaveCount(1);
    await expect(page.locator("main [lang='es']")).toHaveCount(0);

    // Visiting /es saves Spanish, which "/" would reopen; the English page is for a new visitor.
    await page.context().clearCookies();
    await page.goto("/");
    await expect(page.locator("main [lang='es']")).toHaveCount(1);
  });

  test("keeps a start button at the bottom of a phone once the goal box scrolls away", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { height: 844, width: 390 } });
    const page = await context.newPage();

    try {
      await page.goto("/");

      const startLink = page.getByRole("link", { exact: true, name: "Start" });
      await expect(startLink).toBeHidden();

      await page
        .getByRole("heading", { name: "Practice shaped by your goal" })
        .scrollIntoViewIfNeeded();

      await expect(startLink).toBeVisible();
      await expect(startLink).toHaveAttribute("href", "/start");

      await page
        .getByRole("heading", { name: "What do you want to get ready for?" })
        .scrollIntoViewIfNeeded();

      await expect(startLink).toBeHidden();
    } finally {
      await context.close();
    }
  });
});

const MOVE = "speak Spanish for my move to Madrid";
const EXAM = "pass the SAT in March";

/**
 * Opens the home page and, once React runs the goal box, holds time still: from then on the
 * examples change only when the test moves the clock.
 */
async function openHome(page: Page) {
  await page.clock.install();
  await page.goto("/");

  await expect
    .poll(() =>
      page.evaluate(() => {
        const box = document.querySelector("#goal");
        return Boolean(box && Object.keys(box).some((key) => key.startsWith("__reactProps")));
      }),
    )
    .toBe(true);

  await page.clock.pauseAt(new Date(Date.now() + 500));

  return page.getByRole("region", { name: /Get ready for/u }).locator("form");
}

test.describe("The home goal box", () => {
  test("shows example goals one at a time until the visitor starts on their own", async ({
    page,
  }) => {
    const box = await openHome(page);
    const move = box.getByText(MOVE, { exact: true });
    const exam = box.getByText(EXAM, { exact: true });

    await expect(move).toBeVisible();
    await expect(exam).toBeHidden();

    await page.clock.fastForward(4000);
    await expect(exam).toBeVisible();
    await expect(move).toBeHidden();

    // Start with nothing written puts the cursor in the box instead of sending the example.
    await box.getByRole("button", { exact: true, name: "Start" }).click();
    await expect(box.getByRole("textbox", { name: "I want to" })).toBeFocused();
    await expect(page).toHaveURL(/\/$/u);

    // Once the visitor is in the box, the example stays put, and their words replace it.
    await page.clock.fastForward(10_000);
    await expect(exam).toBeVisible();

    await box.getByRole("textbox", { name: "I want to" }).fill("learn to cook");
    await expect(exam).toBeHidden();
  });

  test("with reduced motion, the box keeps its first example", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const box = await openHome(page);

    await page.clock.fastForward(10_000);

    await expect(box.getByText(MOVE, { exact: true })).toBeVisible();
    await expect(box.getByText(EXAM, { exact: true })).toBeHidden();
  });
});

test.describe("The class example on the home page", () => {
  test("the buddy explains it another way or goes further, and a second tap takes it back", async ({
    page,
  }) => {
    await page.goto("/");

    const example = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: "Keep up in class" }) });

    const invitation = example.getByText("Stuck, or curious for more? Just ask.");
    const simpler = example.getByRole("button", { name: "Explain it more simply" });
    const deeper = example.getByRole("button", { name: "I want to go deeper" });

    await expect(example.getByText(/^A derivative is how fast/u)).toBeVisible();
    await expect(invitation).toBeVisible();
    await expectAccessibleScreen(page, "the home page");

    await simpler.click();
    await expect(simpler).toHaveAttribute("aria-pressed", "true");
    await expect(example.getByText(/^Think of a speedometer/u)).toBeVisible();
    await expect(invitation).toBeHidden();

    await deeper.click();
    await expect(example.getByText(/^It's the slope of the line/u)).toBeVisible();
    await expect(simpler).toHaveAttribute("aria-pressed", "false");

    await deeper.click();
    await expect(invitation).toBeVisible();
  });
});

test.describe("Home page for learners", () => {
  test("sends learners with an account to Today before the page renders, until they sign out", async ({
    userWithoutProgress,
  }) => {
    const response = await userWithoutProgress.request.get("/", { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toMatch(/\/today$/u);

    // Signed out and started again as a guest, they keep the home page.
    const options = { data: {}, headers: { Origin: getBaseURL() } };
    const signedOut = await userWithoutProgress.request.post("/api/auth/sign-out", options);
    expect(signedOut.ok(), await signedOut.text()).toBe(true);

    const guest = await userWithoutProgress.request.post("/api/auth/sign-in/anonymous", options);
    expect(guest.ok(), await guest.text()).toBe(true);

    const home = await userWithoutProgress.request.get("/", { maxRedirects: 0 });
    expect(home.status()).toBe(200);
  });
});

test.describe("Pages that don't exist", () => {
  test("show the app's 404 with a way home, in the visitor's language", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "We couldn't find this page" })).toBeVisible();
    await page.getByRole("link", { name: "Go to the home page" }).click();
    await expect(page).toHaveURL(/\/$/u);

    await page.goto("/de/diese-seite-gibt-es-nicht");

    await expect(
      page.getByRole("heading", { name: "Diese Seite wurde nicht gefunden" }),
    ).toBeVisible();

    await expect(page.getByRole("main")).toHaveAttribute("lang", "de");
  });
});
