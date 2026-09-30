import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type Page, expect, test } from "./fixtures";

const LOCALES = ["en", "es", "pt", "fr", "de"] as const;

function homePath(locale: (typeof LOCALES)[number]) {
  return locale === "en" ? "/" : `/${locale}`;
}

async function readHtmlLang(page: Page) {
  return page.evaluate(() => document.documentElement.lang);
}

test.describe("Home page for visitors", () => {
  for (const locale of LOCALES) {
    test(`renders in ${locale}`, async ({ page }) => {
      await page.goto(homePath(locale));

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("textbox")).toHaveCount(2);
      expect(await readHtmlLang(page)).toBe(locale);
    });
  }

  test("translates the page for each language", async ({ page }) => {
    await page.goto("/");
    const english = await page.getByRole("heading", { level: 1 }).textContent();

    await page.goto("/pt");
    const portuguese = await page.getByRole("heading", { level: 1 }).textContent();

    expect(english).toContain("Get ready for");
    expect(portuguese).not.toBe(english);
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

test.describe("Focus and Fun on the home page", () => {
  test("shows Focus first, and the Fun tab brings Fun's pitch, lesson and voyage", async ({
    page,
  }) => {
    await page.goto("/");

    const focusTitle = page.getByRole("heading", { name: "Calm and simple" });
    const fun = page.getByRole("tabpanel", { name: "Fun" });
    const route = fun.getByRole("heading", { name: "The route to Madrid" });

    await expect(page.getByRole("tab", { name: "Focus" })).toHaveAttribute("aria-selected", "true");
    await expect(focusTitle).toBeVisible();
    await expect(route).toBeHidden();

    await page.getByRole("tab", { name: "Fun" }).click();

    await expect(
      fun.getByRole("heading", { name: "Learning that feels like a game" }),
    ).toBeVisible();

    await expect(fun.getByText(/^Your plan becomes a space voyage/u)).toBeVisible();
    await expect(route).toBeVisible();
    await expect(fun.getByRole("heading", { name: "A buddy you feed by learning" })).toBeVisible();
    await expect(focusTitle).toBeHidden();
  });
});

test.describe("The class example on the home page", () => {
  test("Simpler and Go deeper swap the explanation, and a second tap brings it back", async ({
    page,
  }) => {
    await page.goto("/");

    const example = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: "Keep up in class" }) });

    const original = example.getByText(/^A derivative is how fast/u);
    const simpler = example.getByRole("button", { name: "Simpler" });

    await expect(original).toBeVisible();

    await simpler.click();
    await expect(simpler).toHaveAttribute("aria-pressed", "true");
    await expect(example.getByText(/^Think of a speedometer/u)).toBeVisible();
    await expect(original).toBeHidden();

    await example.getByRole("button", { name: "Go deeper" }).click();
    await expect(example.getByText(/^It's the slope of the line/u)).toBeVisible();
    await expect(simpler).toHaveAttribute("aria-pressed", "false");

    await example.getByRole("button", { name: "Go deeper" }).click();
    await expect(original).toBeVisible();
  });
});

test.describe("Home page for learners", () => {
  test("sends learners with an account to Today before the page renders", async ({
    authenticatedPage,
  }) => {
    const response = await authenticatedPage.request.get("/", { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toMatch(/\/today$/u);
  });

  test("keeps the home page for guests", async ({ page }) => {
    const guest = await page.request.post("/api/auth/sign-in/anonymous", {
      data: {},
      headers: { Origin: getBaseURL() },
    });

    expect(guest.ok(), await guest.text()).toBe(true);

    const response = await page.request.get("/", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
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
