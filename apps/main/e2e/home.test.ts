import { type Locator } from "@playwright/test";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type Page, expect, test } from "./fixtures";
import { tabTo } from "./keyboard-focus";

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

/** The first screen: the promise, the goal box and the example goals' window. */
function getHero(page: Page) {
  return page.getByRole("region", { name: /Know what to study/u });
}

function getExampleGoals(page: Page) {
  return getHero(page).getByRole("radiogroup", { name: "Example goals" });
}

const MS_PER_DAY = 86_400_000;

/**
 * The month of a day some days after today (UTC, the English examples' calendar): the examples
 * are written as of a Tuesday and move with the real calendar, so their months follow today.
 */
function monthIn(days: number): string {
  return new Date(Date.now() + days * MS_PER_DAY).toLocaleString("en", {
    month: "long",
    timeZone: "UTC",
  });
}

/** The example the goal box draws under its words (screen readers hear their own copy of it). */
function getDrawnExample(box: Locator) {
  return box.locator("[data-slot='goal-example']");
}

/** The English page's example goals, each as the switch names it and as the goal box writes it. */
const GOALS = {
  exam: {
    box: `get ready for the SAT in ${monthIn(151)}`,
    radio: new RegExp(`^SAT in ${monthIn(151)}`, "u"),
  },
  job: {
    box: `get promoted to data analyst by ${monthIn(240)}`,
    radio: new RegExp(`^Data analyst by ${monthIn(240)}`, "u"),
    switch: `Data analyst by ${monthIn(240)}`,
  },
  move: {
    box: `speak Spanish for my move to Madrid in ${monthIn(139)}`,
    radio: /^Spanish for Madrid/u,
  },
} as const;

/** The stop on practice, named by the picked goal's own title. */
const PRACTICE_TITLES = {
  exam: "Practice like the real exam.",
  job: "Practice on real work.",
  move: "Practice the conversations you'll have.",
} as const;

/** Waits until React runs the hero's goal box, so a tap on its button is handled by the page. */
async function waitForGoalBox(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const box = document.querySelector("#goal");
        return Boolean(box && Object.keys(box).some((key) => key.startsWith("__reactProps")));
      }),
    )
    .toBe(true);
}

test.describe("Home page for visitors", () => {
  test("renders and translates the page in every language", async ({ page }) => {
    const headings: Partial<Record<Locale, string | null>> = {};

    for (const locale of LOCALES) {
      // oxlint-disable-next-line no-await-in-loop -- One page opens each language in turn.
      headings[locale] = await readHomeHeading(page, locale);
    }

    expect(headings.en).toContain("the big day");
    expect(headings.pt).not.toBe(headings.en);
  });

  test("never suggests learning the language the page is written in", async ({ page }) => {
    // A move abroad is to learn another language: English on every page not in English.
    await page.goto("/es");
    await expect(page.locator("main [lang='es']")).toHaveCount(0);
    await expect(page.locator("main [lang='en']").first()).toBeAttached();

    await page.goto("/pt");
    await expect(page.locator("main [lang='pt']")).toHaveCount(0);
    await expect(page.locator("main [lang='en']").first()).toBeAttached();

    // Visiting a language's page saves it, which "/" would reopen; the English page is for a new
    // visitor, whose move is to Madrid.
    await page.context().clearCookies();
    await page.goto("/");
    await expect(page.locator("main [lang='en']")).toHaveCount(0);
    await expect(page.locator("main [lang='es']").first()).toBeAttached();
    await expectAccessibleScreen(page, "the home page");
  });

  test("a swipe row is a tab stop only where it scrolls", async ({ browser }) => {
    for (const { tabIndex, width } of [
      { tabIndex: "0", width: 390 },
      { tabIndex: "-1", width: 1440 },
    ]) {
      // oxlint-disable-next-line no-await-in-loop -- One screen size at a time.
      const context = await browser.newContext({ viewport: { height: 900, width } });

      try {
        // oxlint-disable-next-line no-await-in-loop -- One screen size at a time.
        const page = await context.newPage();
        // oxlint-disable-next-line no-await-in-loop -- One screen size at a time.
        await page.goto("/");

        // oxlint-disable-next-line no-await-in-loop -- One screen size at a time.
        await expect(page.locator("[data-slot='frames']")).toHaveAttribute("tabindex", tabIndex);
      } finally {
        // oxlint-disable-next-line no-await-in-loop -- One screen size at a time.
        await context.close();
      }
    }
  });

  test("keeps a start button at the bottom of a phone once the goal box scrolls away", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { height: 844, width: 390 } });
    const page = await context.newPage();

    try {
      // Nothing on the page scrolls it sideways, in either language's longer words.
      for (const path of ["/", "/pt"]) {
        // oxlint-disable-next-line no-await-in-loop -- One page opens each language in turn.
        await page.goto(path);

        // oxlint-disable-next-line no-await-in-loop -- Each language is measured on its own page.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );

        expect(overflow, path).toBe(0);
      }

      // The Portuguese page saved its language, which "/" would reopen.
      await context.clearCookies();
      await page.goto("/");

      const startLink = page.getByRole("link", { exact: true, name: "Start free" });
      await expect(startLink).toBeHidden();

      await page
        .getByRole("heading", { name: "Your plan starts where you are." })
        .scrollIntoViewIfNeeded();

      await expect(startLink).toBeVisible();
      await expect(startLink).toHaveAttribute("href", "/start");

      await page.getByRole("heading", { name: "What's your big day?" }).scrollIntoViewIfNeeded();
      await expect(startLink).toBeHidden();
    } finally {
      await context.close();
    }
  });
});

test.describe("The example goals", () => {
  test("the picked goal's plan shows, and the whole page follows it, by mouse and keyboard", async ({
    page,
  }) => {
    await page.goto("/");
    const goals = getExampleGoals(page);
    const box = getHero(page).locator("form");

    // The exam is picked on arrival: its plan, its example in the box and its practice.
    await expect(goals.getByRole("radio", { name: GOALS.exam.radio })).toBeChecked();
    await expect(getDrawnExample(box).getByText(GOALS.exam.box, { exact: true })).toBeVisible();
    await expect(getHero(page).getByText(/^SAT · \d+ days left · On pace$/u)).toBeVisible();

    await expect(page.getByRole("heading", { level: 2, name: PRACTICE_TITLES.exam })).toBeVisible();

    // A tap on another goal shows its plan, its example and its practice, and hides the exam's.
    await goals.getByText("Spanish for Madrid", { exact: true }).click();
    await expect(goals.getByRole("radio", { name: GOALS.move.radio })).toBeChecked();
    await expect(getDrawnExample(box).getByText(GOALS.move.box, { exact: true })).toBeVisible();
    await expect(getDrawnExample(box).getByText(GOALS.exam.box, { exact: true })).toBeHidden();

    await expect(page.getByRole("heading", { level: 2, name: PRACTICE_TITLES.move })).toBeVisible();

    await expect(page.getByText("Why “piso” and not “apartamento”?")).toBeVisible();

    // The arrow keys move between the goals, as in any radio group.
    await goals.getByRole("radio", { name: GOALS.move.radio }).focus();
    await page.keyboard.press("ArrowDown");

    const job = goals.getByRole("radio", { name: GOALS.job.radio });
    await expect(job).toBeChecked();
    await expect(job).toBeFocused();
    await expect(getDrawnExample(box).getByText(GOALS.job.box, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: PRACTICE_TITLES.job })).toBeVisible();
  });

  test("a missed day shows yesterday's lesson first and the plan's change; a studied one changes nothing", async ({
    page,
  }) => {
    await page.goto("/");
    const yesterday = page.getByRole("radiogroup", { name: "Yesterday" });

    // Each example goal has its own day in the page; only the picked goal's shows.
    const changed = page.getByText("Your plan changed").filter({ visible: true });
    const unchanged = page.getByText("On pace. Nothing moves.").filter({ visible: true });

    await expect(yesterday.getByRole("radio", { name: "No time" })).toBeChecked();
    await expect(changed).toBeVisible();
    await expect(unchanged).toHaveCount(0);

    await yesterday.getByText("Studied", { exact: true }).click();
    await expect(unchanged).toBeVisible();
    await expect(changed).toHaveCount(0);
  });

  test("without scripts, typing hides the example and both switches still change what shows", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    try {
      await page.goto("/");

      const examExample = getDrawnExample(getHero(page).locator("form")).getByText(GOALS.exam.box, {
        exact: true,
      });

      await expect(examExample).toBeVisible();
      const field = getHero(page).getByRole("textbox", { name: "I want to" });
      await field.fill("learn to cook");
      await expect(examExample).toBeHidden({ timeout: 200 });
      await field.clear();
      const box = getHero(page).locator("form");

      await getExampleGoals(page).getByText(GOALS.job.switch, { exact: true }).click();
      await expect(getDrawnExample(box).getByText(GOALS.job.box, { exact: true })).toBeVisible();
      await expect(getDrawnExample(box).getByText(GOALS.exam.box, { exact: true })).toBeHidden();

      await expect(
        page.getByRole("heading", { level: 2, name: PRACTICE_TITLES.job }),
      ).toBeVisible();

      await page
        .getByRole("radiogroup", { name: "Yesterday" })
        .getByText("Studied", { exact: true })
        .click();

      await expect(
        page.getByText("On pace. Nothing moves.").filter({ visible: true }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe("The home goal box", () => {
  test("shows the picked goal as its example until the visitor writes their own", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForGoalBox(page);
    await tabTo(page, getHero(page).getByRole("textbox", { name: "I want to" }));

    const box = getHero(page).locator("form");
    const example = getDrawnExample(box).getByText(GOALS.exam.box, { exact: true });
    await expect(example).toBeVisible();

    // Screen readers hear the example too, and only the one showing.
    const field = box.getByRole("textbox", { name: "I want to" });
    await expect(field).toHaveAccessibleDescription(`For example: ${GOALS.exam.box}`);

    // Building a plan with nothing written puts the cursor in the box instead of sending the
    // example, and says what to do in the note's place.
    const hero = getHero(page);
    const hint = hero.getByText("Write your goal in the box first, in your own words.");
    await box.getByRole("button", { exact: true, name: "Build my plan" }).click();
    await expect(field).toBeFocused();
    await expect(hint).toBeVisible();
    await expect(hero.getByText("Start free, no account needed.")).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/u);

    // The first letter hides the example at once, so the visitor's words never sit on top of it,
    // and the note comes back.
    await field.fill("learn to cook");
    await expect(example).toBeHidden({ timeout: 200 });
    await expect(hint).toHaveCount(0);
    await expect(hero.getByText("Start free, no account needed.")).toBeVisible();
  });

  test("fits every goal's example on one line beside the button on a laptop", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { height: 800, width: 1280 } });
    const page = await context.newPage();

    try {
      for (const locale of ["en", "pt"] as const) {
        // oxlint-disable-next-line no-await-in-loop -- One page opens each language in turn.
        await page.goto(homePath(locale));

        // Every goal is picked in turn; its example is the one the box shows.
        // oxlint-disable-next-line no-await-in-loop -- Each language is measured on its own page.
        const lines = await page.evaluate(async () => {
          const radios = [
            ...document.querySelectorAll<HTMLInputElement>("input[name='landing-goal']"),
          ];

          const counts: number[] = [];

          for (const radio of radios) {
            radio.click();
            // oxlint-disable-next-line no-await-in-loop -- The next frame applies the pick.
            await new Promise(requestAnimationFrame);

            const shown = [
              ...document.querySelectorAll<HTMLElement>("#goal [data-slot='goal-example'] > *"),
            ].find((span) => getComputedStyle(span).display !== "none");

            counts.push(shown?.getClientRects().length ?? 0);
          }

          return counts;
        });

        expect(lines, locale).toStrictEqual([1, 1, 1]);
      }
    } finally {
      await context.close();
    }
  });
});

test.describe("Home page for learners", () => {
  test("sends anyone with a session to Today before the page renders, and back after signing out", async ({
    userWithoutProgress,
  }) => {
    const response = await userWithoutProgress.request.get("/pt", { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe("/pt/today");

    // Signed out, the home page is back; a guest who started again opens Today too. The visit
    // above saved Portuguese as the language, so `/` would only lead to `/pt`: ask for it there.
    const options = { data: {}, headers: { Origin: getBaseURL() } };
    const signedOut = await userWithoutProgress.request.post("/api/auth/sign-out", options);
    expect(signedOut.ok(), await signedOut.text()).toBe(true);

    const home = await userWithoutProgress.request.get("/pt", { maxRedirects: 0 });
    expect(home.status()).toBe(200);

    const guest = await userWithoutProgress.request.post("/api/auth/sign-in/anonymous", options);
    expect(guest.ok(), await guest.text()).toBe(true);

    const guestHome = await userWithoutProgress.request.get("/pt", { maxRedirects: 0 });
    expect(guestHome.status()).toBe(307);
    expect(guestHome.headers().location).toBe("/pt/today");
  });

  test("a browser holding the cookie of a session that ended is led back to its plan, not to a first goal", async ({
    browser,
  }) => {
    const baseURL = getBaseURL();
    const context = await browser.newContext({ baseURL });

    await context.addCookies([
      { name: "better-auth.session_token", url: baseURL, value: "ended.session" },
    ]);

    const page = await context.newPage();

    // Its plan is still in the account: Today says the session ended, under Today's own title,
    // with logging in back to Today first and starting something new second.
    const expectSessionEnded = async () => {
      const main = page.getByRole("main");

      await expect(main.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();

      await expect(
        main.getByRole("heading", { level: 2, name: "Your session ended" }),
      ).toBeVisible();

      await expect(main.getByText("Log in to pick up your plan.")).toBeVisible();

      await expect(main.getByRole("link", { name: "Log in" })).toHaveAttribute(
        "href",
        "/login?next=%2Ftoday",
      );

      await expect(main.getByRole("link", { name: "Start something new" })).toHaveAttribute(
        "href",
        "/start",
      );

      await expect(page.getByRole("textbox", { name: "I want to" })).toHaveCount(0);
    };

    await page.goto("/");
    await expect(page).toHaveURL(`${baseURL}/today`);
    await expectSessionEnded();

    await page.goto("/today");
    await expectSessionEnded();

    // Every page that needs the account says the same, and logging in comes back to that page.
    await page.goto("/plan");

    await expect(
      page.getByRole("main").getByRole("heading", { level: 2, name: "Your session ended" }),
    ).toBeVisible();

    await expect(page.getByRole("main").getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login?next=%2Fplan",
    );

    await page.goto("/stats");

    await expect(
      page.getByRole("main").getByRole("heading", { level: 2, name: "Your session ended" }),
    ).toBeVisible();

    await context.close();
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
