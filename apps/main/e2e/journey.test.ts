import { randomUUID } from "node:crypto";
import { ONBOARDING_QUESTIONS } from "@zoonk/core/view-models/onboarding/contract";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { isJsonObject } from "@zoonk/utils/json";
import { z } from "zod";
import { type Page, expect, test } from "./fixtures";
import { type StreamEvent, followRun } from "./generation-run";
import { asPersona } from "./learn-personas";
import { openAs } from "./study-day";

/**
 * The Journey replaces Plan, Progress and Content: where the learner stands in one number (its
 * details in a sheet), the plan's fit when it needs adjusting, the path of phases (a timeline for a
 * goal with subjects, the current one open to its chapters otherwise) with its checkpoint, the goal
 * as the finish, the goal's subjects, and the mistakes to fix. The "…" adjusts the plan and holds
 * what's done now and then. `journey-syllabus.test.ts` covers subjects in depth.
 */

const phasesSchema = z.array(z.object({ endDate: z.iso.date() }));

/** Every onboarding question, so `/start/{goalId}` opens on the plan. */
const ALL_ANSWERED = [...ONBOARDING_QUESTIONS, "buddy", "placement"];

const STATUS =
  /(?:Keeping pace|Needs adjusting|One day (?:ahead|behind)|\d+ days (?:ahead|behind))/u;

/** A list row's least height: a tap target with room for its title. */
const MIN_ROW_HEIGHT = 44;

async function openJourney(page: Page) {
  await page.goto("/journey");
  await expect(page.locator('[data-slot="journey"]')).toBeVisible();
}

function journeyPath(page: Page) {
  return page.getByRole("list", { name: "Your journey" });
}

async function openMenu(page: Page) {
  await page.getByRole("button", { name: "Journey options" }).click();
  return page.getByRole("menu");
}

async function loadPlanSettings(goalId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
  return plan.settings;
}

async function loadFocusAreas(goalId: string): Promise<unknown> {
  const settings = await loadPlanSettings(goalId);
  return isJsonObject(settings) ? settings.focusAreas : null;
}

/** A learner with a learn goal of two skills, none studied yet, and a quick explanation. */
async function createLearnAndExplainLearner() {
  const user = await createE2EUser(getBaseURL());

  const [learn, chapter, skills, explanation] = await Promise.all([
    goalFixture({ timezone: "UTC", title: "Learn percentages", userId: user.id }),
    libraryChapterFixture({ title: "Percentages" }),
    Promise.all(["Percent of a number", "Percent change"].map((name) => skillFixture({ name }))),
    goalFixture({ kind: "explain", title: "Why the market is up 2%", userId: user.id }),
  ]);

  const [plan] = await Promise.all([
    planFixture({ goalId: learn.id, phases: [{ name: "Percent basics" }] }),
    learningProfileFixture({ activeGoalId: learn.id, userId: user.id }),
  ]);

  await Promise.all(
    skills.map((skill, position) =>
      planItemFixture({ chapterId: chapter.id, planId: plan.id, position, skillId: skill.id }),
    ),
  );

  return { chapter, explanation, user };
}

test.describe("Journey", () => {
  test("shows where Ana stands, her plan's phases, what's on her exam and her mistakes", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page }) => {
      await openJourney(page);

      // One number and its status; the details wait behind it.
      const hero = page.locator('[data-slot="journey-hero"]');
      await expect(hero).toContainText(/^\d+%\s*Your preparation/u);
      await expect(hero).toContainText(STATUS);

      // The path is a timeline: every phase, then the goal itself.
      const path = journeyPath(page);
      const nodes = path.locator(":scope > li");
      await expect(nodes).toHaveCount(5);
      await expect(nodes.first()).toContainText("Foundations");
      await expect(nodes.last()).toHaveAttribute("data-state", "finish");

      // The phase she's in holds its next mock and the challenge that closes it, not chapters:
      // those live under her exam's subjects.
      const current = path.locator('li[aria-current="step"]');
      await expect(current).toContainText(", you are here");

      await expect(current.getByRole("link", { name: /^Mock exam/u })).toHaveAttribute(
        "href",
        "/exam",
      );

      await expect(current.getByRole("link", { name: /^Phase challenge/u })).toHaveAttribute(
        "href",
        /^\/challenge\/[\da-f-]{36}$/u,
      );

      await expect(path.getByRole("link", { name: /Up next/u })).toHaveCount(0);
      await expect(path.getByText(/^\d+ mock exams?$/u).first()).toBeVisible();

      // The finish is the exam, which opens what's on it.
      await expect(nodes.last().getByRole("link", { name: /About the exam/u })).toHaveAttribute(
        "href",
        "/exam",
      );

      // What's on the exam: the notice's subjects in its words, each opening its page, with the
      // foreign language she takes inside Linguagens, as the notice counts it.
      const syllabus = page.getByRole("region", { name: "What's on the exam" });
      await expect(syllabus.getByText(/^5 subjects · \d+ topics$/u)).toBeVisible();

      // Her plan's own area beyond the notice (exam strategy) comes after the notice's subjects.
      await expect(syllabus.getByRole("list").getByRole("link")).toHaveText([
        /^Linguagens, Códigos e suas Tecnologias/u,
        /^Ciências Humanas e suas Tecnologias/u,
        /^Ciências da Natureza e suas Tecnologias/u,
        /^Matemática e suas Tecnologias/u,
        /^Redação/u,
        /^Estratégia de prova/u,
      ]);

      // The notice doesn't count the foreign language's questions: its count cites who did.
      await expect(syllabus.getByRole("link", { name: "download.inep.gov.br" })).toBeVisible();

      // What the old tabs listed lives elsewhere now: mocks and the mistakes notebook are practiced
      // from Today.
      await expect(page.getByRole("link", { name: /^Mistakes notebook/u })).toHaveCount(0);
      await expect(page.getByRole("link", { name: /^Take a mock exam/u })).toHaveCount(0);
      await expect(page.getByRole("region", { name: "This week" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: /^Weekly summary/u })).toHaveCount(0);
      await expect(page.getByRole("textbox", { name: /Search/u })).toHaveCount(0);

      await expectAccessibleScreen(page, "the Journey");

      // The details behind the number, at a glance: the estimate after her mock, on ENEM's scale,
      // the four parts as rings and the one or two things still to do, then back to where she was.
      await hero.click();
      const sheet = page.getByRole("dialog", { name: "Your preparation" });
      const estimate = sheet.locator('[data-slot="estimated-score"]');

      await expect(estimate).toContainText("Estimated score");
      await expect(estimate.getByText(/^\d+ to \d+$/u)).toBeVisible();
      await expect(estimate.getByText("Based on your last mock exam")).toBeVisible();

      await expect(
        sheet.getByRole("region", { name: "How it's measured" }).getByRole("listitem"),
      ).toHaveCount(4);

      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      await expect(hero).toBeFocused();

      // "Adjust plan" sits in the card's action row; the "…" beside it holds what's done now and then.
      await expect(page.getByRole("button", { name: "Adjust plan" })).toBeVisible();
      const menu = await openMenu(page);
      await expect(menu.getByRole("menuitem").first()).toHaveText("About the exam");

      await expect(menu.getByRole("menuitem", { name: "About the exam" })).toHaveAttribute(
        "href",
        "/exam",
      );

      await expect(menu.getByRole("menuitem", { name: "Share the plan" })).toBeVisible();

      await expect(menu.getByRole("menuitem", { name: /^Talk to /u })).toHaveAttribute(
        "href",
        "/buddy",
      );

      await menu.getByRole("menuitem", { name: "Report a problem" }).click();
      await expect(page.getByRole("dialog", { name: "Report a problem" })).toBeVisible();
      await page.keyboard.press("Escape");

      // A subject opens its page: its chapters, the next one first, and the notice's topics in the
      // notice's words alone, with no second index beside them, each with where she stands on it;
      // the ones past exams asked most say so.
      await syllabus.getByRole("link", { name: /^Matemática e suas Tecnologias/u }).click();
      await expect(page).toHaveURL(/\/journey\/matematica-e-suas-tecnologias$/u);

      await expect(
        page.getByRole("heading", { level: 1, name: "Matemática e suas Tecnologias" }),
      ).toBeVisible();

      await expect(
        page.getByRole("list", { name: "Topics in the notice" }).getByRole("listitem"),
      ).toHaveText([
        "Conhecimentos numéricos, in progressAppears a lot",
        "Conhecimentos geométricos, to study",
        "Conhecimentos de estatística e probabilidade, to studyAppears a lot",
        "Conhecimentos algébricos, to study",
        "Conhecimentos algébricos/geométricos, to study",
      ]);

      const chapters = page.getByRole("region", { name: "Chapters" });
      const chapter = chapters.getByRole("link").first();

      await expect(chapter).toHaveAttribute(
        "href",
        /^\/content\/chapters\/[\da-f-]{36}\?from=matematica-e-suas-tecnologias$/u,
      );

      // A chapter's way back is the subject it was opened from; the subject's is the Journey.
      await chapter.click();
      const back = page.getByRole("main").getByRole("link", { name: "Back to Matemática" });
      await expect(back).toHaveAttribute("href", "/journey/matematica-e-suas-tecnologias");
      await back.click();

      await page.getByRole("main").getByRole("link", { name: "Back to Journey" }).click();
      await expect(page).toHaveURL(/\/journey$/u);
    });
  });

  // Ana's sheet read 91% Mastery beside a headline that counted about 68%, "3 of 35 skills" beside
  // a ring weighted another way, and "29 skills to go" counting a third thing.
  test("the preparation sheet's rings and rows read what the headline counts", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page }) => {
      await openJourney(page);
      await page.locator('[data-slot="journey-hero"]').click();
      const sheet = page.getByRole("dialog", { name: "Your preparation" });
      const parts = sheet.getByRole("region", { name: "How it's measured" }).getByRole("listitem");

      await expect(parts).toHaveText([
        /^\d+%Coverage: \d+%\d+ of \d+ skills, weighted by importance$/u,
        /^\d+%Mastery: \d+%\d+ of \d+ right$/u,
        /^\d+%Long-term memory: \d+%Of what you studied$/u,
        /^\d+%Mock exams: \d+%1 mock exam taken$/u,
      ]);

      // Mastery is a share right only as high as the number of answers supports, below the plain
      // share of a few answers.
      const mastery = /^(?<ring>\d+)%Mastery: \d+%(?<correct>\d+) of (?<answered>\d+) right$/u.exec(
        (await parts.nth(1).textContent()) ?? "",
      )?.groups;

      expect(Number(mastery?.correct)).toBeGreaterThan(0);

      expect(Number(mastery?.ring)).toBeLessThan(
        (Number(mastery?.correct) / Number(mastery?.answered)) * 100,
      );

      // Only what's left, never a checklist: her mock exam is done, so it isn't there. No second
      // count of skills beside Coverage's.
      await expect(
        sheet.getByRole("region", { name: "Still to do" }).getByRole("listitem"),
      ).toHaveText([
        /^Get the topics that weigh most to Solid(?:\s*About .+ in your plan)?$/u,
        /^Keep what you studied fresh\s*\d+ skills? fading, back in your reviews$/u,
      ]);
    });
  });

  test("the old tabs and the subject map lead to the Journey", async ({ browser }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page }) => {
      // The old pages answer with a redirect, so following each one ends on the Journey.
      const landed = await Promise.all(
        ["/plan", "/progress", "/content", "/content/map"].map(async (path) => {
          const response = await page.request.get(path);
          return new URL(response.url()).pathname;
        }),
      );

      expect(landed).toStrictEqual(["/journey", "/journey", "/journey", "/journey"]);

      await page.goto("/pt/plan");
      await expect(page).toHaveURL(/\/pt\/journey$/u);
      await expect(page.getByRole("heading", { level: 2, name: "Sua trilha" })).toBeVisible();
    });
  });

  test("a plan that doesn't fit says how much it covers, and the editor fixes it, from the keyboard too", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      // The exam moved two months away, and Ana cut her time to 10 minutes a day in the editor,
      // which plans again (a time written to the database would leave her old plan in place).
      await prisma.goal.update({
        data: { targetDate: new Date(toUTCMidnight(new Date()).getTime() + 60 * MS_PER_DAY) },
        where: { id: user.goalId },
      });

      await openJourney(page);
      await page.getByRole("button", { name: "Adjust plan" }).click();
      const editor = page.getByRole("dialog", { name: "Adjust your plan" });
      const minutes = editor.getByLabel("Time a day");

      await minutes.selectOption("10");

      await expect(
        editor.getByRole("status").filter({ hasText: "Daily time changed to 10 min." }),
      ).toBeVisible();

      await editor.getByRole("button", { name: "Close" }).click();
      await expect(editor).toBeHidden();

      // Ten minutes don't reach every topic: it says so, and the one time plans recommend, the
      // number the time step said, not a second "every topic" time.
      await expect(
        page.getByText(
          "10 min a day doesn't reach every topic: the ones that come up least are left out.",
        ),
      ).toBeVisible();

      await expect(
        page.getByText(
          /^To study everything in depth: .+ a day\.$|^Even at .+ a day, you'd study about \d+% of everything in depth by your date\.$/u,
        ),
      ).toBeVisible();

      await expect(page.getByText(/^To study every topic:/u)).toHaveCount(0);

      // The buddy's "Choose where to focus" opens the Journey with the sheet open; Esc closes it.
      await page.goto("/journey?focus=choose");
      await expect(page.getByRole("dialog", { name: "Where to focus" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Where to focus" })).toBeHidden();

      // Where her few minutes go is hers to choose: the sheet says what the focus did, with an
      // undo, before it closes.
      await page.getByRole("button", { name: "Choose where to focus" }).click();
      const focus = page.getByRole("dialog", { name: "Where to focus" });

      await focus.getByRole("checkbox", { name: "Matemática" }).click();
      await focus.getByRole("button", { name: "Focus on these" }).click();

      await expect(focus.getByRole("status")).toContainText("More time for");
      await expect(focus.getByRole("status")).toContainText("Matemática");
      await expect(focus.getByRole("button", { name: "Undo" })).toBeVisible();
      await focus.getByRole("button", { name: "Done" }).click();
      await expect(focus).toBeHidden();

      await expect.poll(() => loadFocusAreas(user.goalId)).toContain("Matemática");

      await page.getByRole("button", { name: "Adjust plan" }).click();

      await expect(minutes.getByRole("option", { name: /\(recommended\)/u })).toHaveCount(1);
      await expectAccessibleScreen(page, "the plan editor");

      await minutes.selectOption("60");

      await expect
        .poll(async () => {
          const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
          return goal.dailyMinutes;
        })
        .toBe(60);

      // What the new time covers shows right under it.
      await expect(
        editor.getByText(
          /^(?<coverage>Covers your whole goal\.|1h a day (?<reach>studies every topic|doesn't reach every topic))/u,
        ),
      ).toBeVisible();

      // The toggles wait while the new time plans again, which can take a while, so a press then
      // would do nothing.
      const morePractice = editor.getByRole("button", { name: "More practice" });
      await expect(morePractice).toBeEnabled({ timeout: 15_000 });
      await morePractice.focus();
      await page.keyboard.press("Space");

      await expect(morePractice).toHaveAttribute("aria-pressed", "true");
      // Saving doesn't drop focus to the page: the toggle keeps it while it waits and after.
      await expect(morePractice).toBeFocused();

      await expect
        .poll(() => loadPlanSettings(user.goalId))
        .toMatchObject({ practiceBias: "morePractice" });

      await editor.getByRole("button", { name: "Close" }).click();
      await expect(editor).toBeHidden();

      // "Adjust plan" opens the same editor again, with what she chose.
      await page.getByRole("button", { name: "Adjust plan" }).click();
      await expect(editor.getByLabel("Time a day")).toHaveValue("60");
    });
  });

  test("a goal no daily time covers by its date says what the most time reaches, and moves the date to cover it all", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      // Marcos's move came forward to a month away: even the most time a day can't cover his goal.
      const targetDate = new Date(toUTCMidnight(new Date()).getTime() + 30 * MS_PER_DAY);
      await prisma.goal.update({ data: { targetDate }, where: { id: user.goalId } });

      await openJourney(page);

      const notice = page.locator('[data-slot="plan-notice"]');

      const honest =
        /^Even at .+ a day, you'd study about \d+% of everything in depth by your date\.$/u;

      await expect(notice.getByText(honest)).toBeVisible();
      await expect(notice.getByRole("button", { name: /^Switch to/u })).toHaveCount(0);

      await page.getByRole("button", { name: "Adjust plan" }).click();
      const editor = page.getByRole("dialog", { name: "Adjust your plan" });

      // The most time a day is the one recommended, honestly, with what moving the date does.
      await expect(
        editor.getByLabel("Time a day").getByRole("option", { name: /\(recommended\)/u }),
      ).toHaveAttribute("value", "240");

      await expect(editor.getByText(honest)).toBeVisible();

      await expect(
        editor.getByText(/^At .+ a day, your plan covers everything by .+\.$/u),
      ).toBeVisible();

      await editor.getByRole("button", { name: "Move your date to cover everything" }).click();

      await expect
        .poll(async () => {
          const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
          return goal.targetDate?.getTime() ?? 0;
        })
        .toBeGreaterThan(targetDate.getTime());

      await expect(editor.getByText("Covers your whole goal.")).toBeVisible();

      // Undo gives the month-away date back.
      await editor.getByRole("button", { name: "Undo" }).click();

      await expect
        .poll(async () => {
          const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
          return goal.targetDate?.getTime();
        })
        .toBe(targetDate.getTime());
    });
  });

  test("a focus on part of a subject says which part, and choosing subjects again keeps it", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      // Her own time and date (45 minutes a day, the exam months away) don't hold all of a real
      // ENEM's depth, so where it goes is hers to choose. A time or date written straight to the
      // database would leave her saved plan in place, and every focus would read as no change.
      // The buddy narrowed her focus to part of one subject (its first skill), as she asked.
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });

      const graph = z
        .object({ skills: z.array(z.object({ area: z.string().nullable(), skillId: z.string() })) })
        .parse(plan.graph);

      const [first] = graph.skills;
      const area = first?.area ?? "";
      const part = { area, name: "Biology and chemistry", skillIds: [first?.skillId ?? ""] };
      const settings = isJsonObject(plan.settings) ? plan.settings : {};

      await prisma.plan.update({
        data: { settings: { ...settings, focusAreas: [area], focusParts: [part] } },
        where: { id: plan.id },
      });

      await openJourney(page);
      await page.getByRole("button", { name: "Choose where to focus" }).click();
      const focus = page.getByRole("dialog", { name: "Where to focus" });

      // The subject in focus says which part of it.
      await expect(focus.getByText("Only Biology and chemistry")).toBeVisible();

      // Adding Ciências Humanas, which has depth left to give, keeps the part she named. The sheet
      // says what the focus did, with an undo, before it closes.
      await focus.getByRole("checkbox", { name: "Ciências Humanas" }).click();
      await focus.getByRole("button", { name: "Focus on these" }).click();
      await expect(focus.getByRole("status")).toContainText("More time for");
      await expect(focus.getByRole("status")).toContainText("Ciências Humanas");
      await expect(focus.getByRole("button", { name: "Undo" })).toBeVisible();
      await focus.getByRole("button", { name: "Done" }).click();
      await expect(focus).toBeHidden();

      await expect.poll(() => loadFocusAreas(user.goalId)).toContain("Ciências Humanas");

      await expect
        .poll(async () => {
          const saved = await loadPlanSettings(user.goalId);
          return isJsonObject(saved) ? saved.focusParts : null;
        })
        .toStrictEqual([part]);
    });
  });

  test("the language Ana takes comes inside Linguagens: focusing Linguagens focuses it too, and the card names Linguagens only", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      // Ana takes English, which ENEM counts inside Linguagens: it's never a subject of its own.
      await openJourney(page);
      await page.getByRole("button", { name: "Choose where to focus" }).click();
      const focus = page.getByRole("dialog", { name: "Where to focus" });

      // Linguagens' row names its parts, so only a row of English's own starts with its name.
      await expect(focus.getByRole("checkbox", { name: /^Língua Inglesa/u })).toHaveCount(0);
      await expect(focus.getByText("Includes Língua Inglesa")).toBeVisible();
      // Each checkbox goes by its row's words, said once.
      await expect(focus.getByRole("checkbox", { exact: true, name: "Matemática" })).toBeVisible();

      await focus.getByRole("checkbox", { name: "Linguagens" }).click();
      await focus.getByRole("button", { name: "Focus on these" }).click();

      const status = focus.getByRole("status");
      await expect(status).toContainText("More time for Ciências da Natureza and Linguagens.");
      await expect(status).not.toContainText("Língua Inglesa");
      await focus.getByRole("button", { name: "Done" }).click();
      await expect(focus).toBeHidden();

      await expect
        .poll(() => loadFocusAreas(user.goalId))
        .toStrictEqual(["Ciências da Natureza", "Linguagens", "Língua Inglesa"]);

      // Taking Linguagens out of her focus takes her English out with it.
      await page.getByRole("button", { name: "Choose where to focus" }).click();
      await focus.getByRole("checkbox", { name: "Linguagens" }).click();
      await focus.getByRole("button", { name: "Focus on these" }).click();
      await expect(focus.getByRole("status")).toBeVisible();

      await expect.poll(() => loadFocusAreas(user.goalId)).toStrictEqual(["Ciências da Natureza"]);
    });
  });

  test("gives the weekend its own time in the plan editor, as onboarding does, by keyboard too", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const weekdays = [1, 2, 3, 4, 5];

      // No week of its own (null, or never set) means every day takes the daily time.
      const loadWeek = async () =>
        z
          .object({ weekdayMinutes: z.array(z.number()).nullish() })
          .parse(await loadPlanSettings(user.goalId)).weekdayMinutes ?? null;

      await prisma.goal.update({ data: { dailyMinutes: 30 }, where: { id: user.goalId } });
      await openJourney(page);

      await page.getByRole("button", { name: "Adjust plan" }).click();
      const editor = page.getByRole("dialog", { name: "Adjust your plan" });
      const weekend = editor.getByRole("combobox", { name: "Time on weekends" });
      const toggle = editor.getByRole("switch", { name: "Different time on weekends" });

      // Nothing more shows until the learner wants it.
      await expect(weekend).toBeHidden();
      await toggle.focus();
      await page.keyboard.press("Space");
      await expect(weekend).toHaveValue("30");

      await weekend.selectOption("120");

      await expect.poll(loadWeek).toStrictEqual([120, 30, 30, 30, 30, 30, 120]);

      // The weekdays change on their own, and the weekend keeps what she gave it.
      await editor.getByLabel("Time a day").selectOption("45");

      await expect.poll(loadWeek).toStrictEqual([120, ...weekdays.map(() => 45), 120]);

      await expect(toggle).toBeChecked();

      // Switched off once the change is saved, the weekend goes back to the weekdays' new time.
      await expect(editor.getByLabel("Time a day")).toHaveValue("45");
      await expect(editor.getByLabel("Time a day")).toBeEnabled();
      await toggle.click();
      await expect(weekend).toBeHidden();
      await expect.poll(loadWeek).toBeNull();

      await expect
        .poll(async () => {
          const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
          return goal.dailyMinutes;
        })
        .toBe(45);
    });
  });

  test("says what a time change in the plan editor did, and Undo, or the old time set back, gives the plan back as it was", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      // Each item by what it is, its day and its status: what the learner sees of the plan.
      const loadPlanItems = async () => {
        const items = await prisma.planItem.findMany({
          select: { kind: true, lessonId: true, scheduledFor: true, skillId: true, status: true },
          where: { plan: { goalId: user.goalId } },
        });

        return items
          .map(
            (item) =>
              `${item.kind}:${item.lessonId ?? item.skillId}:${item.scheduledFor?.toISOString() ?? "-"}:${item.status}`,
          )
          .toSorted();
      };

      await openJourney(page);
      await page.getByRole("button", { name: "Adjust plan" }).click();
      const editor = page.getByRole("dialog", { name: "Adjust your plan" });
      const minutes = editor.getByLabel("Time a day");
      const own = await minutes.inputValue();
      const before = await loadPlanItems();
      const other = own === "15" ? "20" : "15";

      await minutes.selectOption(other);

      // The editor says what the change did, under its controls, with a way back.
      await expect(
        editor.getByRole("status").filter({ hasText: `Daily time changed to ${other} min.` }),
      ).toBeVisible();

      await editor.getByRole("button", { name: "Undo" }).click();

      await expect(
        editor.getByRole("status").filter({ hasText: "Undone. Your plan is back as it was." }),
      ).toBeVisible();

      await expect(minutes).toHaveValue(own);
      await expect(editor.getByRole("button", { name: "Undo" })).toHaveCount(0);
      await expect.poll(loadPlanItems).toStrictEqual(before);

      // Setting the old time back by hand is the same Undo, not a plan made again.
      await minutes.selectOption(other);

      await expect(
        editor.getByRole("status").filter({ hasText: `Daily time changed to ${other} min.` }),
      ).toBeVisible();

      await minutes.selectOption(own);

      await expect(
        editor.getByRole("status").filter({ hasText: "Undone. Your plan is back as it was." }),
      ).toBeVisible();

      await expect.poll(loadPlanItems).toStrictEqual(before);
    });
  });

  test("shares the plan's link, which brings its owner back to the Journey", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

      // The copy path on every browser: one with Web Share (Chrome on a Mac) opens the system's
      // share sheet instead, which a test can't read.
      await page.addInitScript(() => {
        Reflect.deleteProperty(Navigator.prototype, "share");
      });

      await openJourney(page);

      const menu = await openMenu(page);
      await menu.getByRole("menuitem", { name: "Share the plan" }).click();
      await expect(page.getByText("Link copied")).toBeVisible();

      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });
      const copied = await page.evaluate(() => navigator.clipboard.readText());

      expect(copied).toMatch(new RegExp(`/plan-link/${plan.id}$`, "u"));

      await page.goto(`/plan-link/${plan.id}`);
      await expect(page).toHaveURL(/\/journey$/u);
    });
  });

  test("a huge goal without a date ends about when its plan does, and questions about the plan go to the buddy", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });

      const phases = phasesSchema.parse(plan.phases);

      const toMonth = new Intl.DateTimeFormat("en", {
        month: "long",
        timeZone: "UTC",
        year: "numeric",
      });

      // "About" its last phase's end: the graph sizes the end (lessons of the average length), so it
      // can land days before the end the seed's longer hand-written lessons give its phases.
      const end = new Date(phases.at(-1)?.endDate ?? "");
      const daysBefore = new Date(end.getTime() - 14 * MS_PER_DAY);
      const months = [end, daysBefore].map((date) => toMonth.format(date));

      await openJourney(page);

      const nodes = journeyPath(page).locator(":scope > li");
      await expect(nodes).toHaveCount(phases.length + 1);
      await expect(nodes.last()).toContainText(new RegExp(`About (${months.join("|")})`, "u"));

      // Placement settled her basics: one row says how many skills she already knows, skipped,
      // never a run-on list of their names. It sits with the chapters behind "N more chapters".
      const path = journeyPath(page);
      const more = path.getByRole("button", { name: /^\d+ more chapters?$/u });
      await more.first().click();

      const settled = path.getByText(/^\d+ skills? you already know$/u);
      await expect(settled.first()).toBeVisible();

      await expect(
        settled.first().locator("xpath=ancestor::li[1]").getByRole("img", { name: "Skipped" }),
      ).toBeVisible();

      await expect(page.getByText(/Read a fraction as a division/u)).toHaveCount(0);

      // Going without tools happens in the editor.
      await page.getByRole("button", { name: "Adjust plan" }).click();

      const tools = page
        .getByRole("dialog", { name: "Adjust your plan" })
        .getByRole("region", { name: "You'll use" });

      await tools
        .getByRole("button", { name: "No tools? You can do it all with examples." })
        .click();

      const note = tools.getByText("You won't practice on your own computer.", { exact: false });
      await expect(note).toBeVisible();
      await expect(note).toBeFocused();

      // Anything the controls don't cover is said to the buddy, in the conversation.
      await expect(
        page
          .getByRole("dialog", { name: "Adjust your plan" })
          .getByRole("link", { name: /^Something else\? Tell /u }),
      ).toHaveAttribute("href", "/buddy");

      await page.keyboard.press("Escape");
      const tutorMenu = await openMenu(page);
      await tutorMenu.getByRole("menuitem", { name: /^Talk to /u }).click();
      await expect(page).toHaveURL(/\/buddy$/u);
    });
  });

  // Juliana never gave her exam's date: her plan's end showed beside the exam as if it were its day.
  test("an exam without a date says its day is to be confirmed, and its last phase when the plan ends", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      await prisma.goal.update({ data: { targetDate: null }, where: { id: user.goalId } });

      await openJourney(page);

      const nodes = journeyPath(page).locator(":scope > li");
      const finish = nodes.last();

      await expect(finish).toHaveAttribute("data-state", "finish");
      await expect(finish).toContainText("Date to be confirmed");
      // No "About September 2027" beside the exam: that's when the plan ends, not the exam's day.
      await expect(finish.getByText(/About [A-Z]/u)).toHaveCount(0);
      await expect(nodes.nth(-2)).toContainText(/Until about \w+/u);
    });
  });

  test("on a phone, the editor's last row stays whole at the end of the sheet and opens the buddy", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page }) => {
      await page.setViewportSize({ height: 664, width: 390 });
      await openJourney(page);
      await page.getByRole("button", { name: "Adjust plan" }).click();

      // The sheet scrolls to it, and it keeps a row's height instead of squeezing to a line.
      const ask = page
        .getByRole("dialog", { name: "Adjust your plan" })
        .getByRole("link", { name: /^Something else\? Tell /u });

      await ask.scrollIntoViewIfNeeded();
      await expect(ask).toBeInViewport({ ratio: 1 });
      const box = await ask.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(MIN_ROW_HEIGHT);

      await ask.click();
      await expect(page).toHaveURL(/\/buddy$/u);
    });
  });

  // Maya's chapters a test took off looked just like the ones she studied.
  test("a chapter a test took off reads as skipped, apart from one studied", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());

    const [goal, chapters, skills] = await Promise.all([
      goalFixture({ timezone: "UTC", title: "Learn ratios", userId: user.id }),
      Promise.all(
        ["Ratios", "Proportions", "Rates"].map((title) => libraryChapterFixture({ title })),
      ),
      Promise.all(
        ["Read a ratio", "Solve a proportion", "Compare rates"].map((name) =>
          skillFixture({ name }),
        ),
      ),
    ]);

    const [plan] = await Promise.all([
      planFixture({ goalId: goal.id, phases: [{ name: "Ratio basics" }] }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    await Promise.all(
      (["done", "testedOut", "todo"] as const).map((status, position) =>
        planItemFixture({
          chapterId: chapters[position]?.id,
          planId: plan.id,
          position,
          skillId: skills[position]?.id,
          status,
        }),
      ),
    );

    const page = await openAs(browser, user);
    await openJourney(page);
    const path = journeyPath(page);

    const studied = path.getByRole("link", { name: /^Done Ratios/u });
    await expect(studied).toBeVisible();
    await expect(studied).not.toContainText("Skipped because you already know it");

    const known = path.getByRole("link", { name: /^Skipped Proportions/u });
    await expect(known).toContainText("Skipped because you already know it");
    await expect(known.getByRole("img", { name: "Skipped" })).toBeVisible();

    await page.context().close();
  });

  // Rafaela studied one lesson of her first phase, then was away for a month: the days she missed
  // set its other lessons aside, and her Journey marked the phase done. The plan moves on to the
  // next phase, and the one it left says how far she got, never a check.
  test("a phase whose lessons were set aside after days away isn't marked done", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());

    const [goal, chapters] = await Promise.all([
      goalFixture({ timezone: "UTC", title: "Learn ratios", userId: user.id }),
      Promise.all(
        ["Ratios", "Proportions", "Rates"].map((title) => libraryChapterFixture({ title })),
      ),
    ]);

    const [plan] = await Promise.all([
      planFixture({ goalId: goal.id, phases: [{ name: "Ratio basics" }, { name: "Rates" }] }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    await Promise.all(
      (
        [
          { phase: 0, status: "done" },
          { phase: 0, status: "skipped" },
          { phase: 1, status: "todo" },
        ] as const
      ).map(({ phase, status }, position) =>
        planItemFixture({
          chapterId: chapters[position]?.id,
          phase,
          planId: plan.id,
          position,
          status,
        }),
      ),
    );

    const page = await openAs(browser, user);
    await openJourney(page);
    const path = journeyPath(page);

    const left = path.locator(":scope > li", { hasText: "Ratio basics" });
    await expect(left).toHaveAttribute("data-state", "unfinished");
    await expect(left).toContainText("1 of 2 lessons done");
    await expect(left).not.toContainText(", done");

    await expect(path.locator(':scope > li[aria-current="step"]')).toContainText("Rates");
    await expect(page.getByText("Phase 2 of 2")).toBeVisible();

    await page.context().close();
  });

  // Missed days set the plan's last lesson aside: nothing is left, but the plan ended rather than
  // finished. The Journey says so plainly, never "You finished your plan", and the plan can change.
  test("a plan whose last lesson was set aside ends without a celebration", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());

    const [goal, chapters] = await Promise.all([
      goalFixture({ timezone: "UTC", title: "Learn ratios", userId: user.id }),
      Promise.all(["Ratios", "Rates"].map((title) => libraryChapterFixture({ title }))),
    ]);

    const [plan] = await Promise.all([
      planFixture({ goalId: goal.id, phases: [{ name: "Ratio basics" }] }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
      studySessionFixture({ goalId: goal.id, userId: user.id }),
    ]);

    await Promise.all(
      (["done", "skipped"] as const).map((status, position) =>
        planItemFixture({ chapterId: chapters[position]?.id, planId: plan.id, position, status }),
      ),
    );

    const page = await openAs(browser, user);
    await openJourney(page);

    const ended = page.getByRole("region", { name: "Your plan ended" });
    await expect(ended).toContainText("1 lesson was left out");
    await expect(page.getByText("You finished your plan")).toHaveCount(0);

    await ended.getByRole("button", { name: "Adjust plan" }).click();
    await expect(page.getByRole("dialog", { name: "Adjust your plan" })).toBeVisible();

    await page.context().close();
  });

  test("a learn goal's progress counts weekly challenges, and a quick explanation has no Journey", async ({
    browser,
  }) => {
    const { chapter, explanation, user } = await createLearnAndExplainLearner();
    const page = await openAs(browser, user);
    await openJourney(page);

    // A goal learned for its own sake reads as a share of the way, never as exam preparation.
    const hero = page.locator('[data-slot="journey-hero"]');
    await expect(hero).toContainText(/^0%\s*Your progress/u);
    await expect(hero).not.toContainText("preparation");

    const row = journeyPath(page).getByRole("link", { name: /Percentages/u });
    await expect(row).toHaveAttribute("href", `/content/chapters/${chapter.id}`);
    await expect(row).toContainText("Up next");

    await hero.click();
    const sheet = page.getByRole("dialog", { name: "Your progress" });
    await expect(sheet.getByText("How your progress is measured")).toBeVisible();
    await expect(sheet.getByText("Weekly challenges", { exact: true })).toBeVisible();
    await expect(sheet.getByText("Mock exams", { exact: true })).toHaveCount(0);
    await expect(sheet.getByText(/^Estimated/u)).toHaveCount(0);
    await page.keyboard.press("Escape");

    // A quick explanation is one answer, not a goal to switch to: it opens itself.
    await page.getByRole("button", { name: /Current goal: Learn percentages/u }).click();
    await expect(page.getByRole("menuitemradio")).toHaveCount(1);

    await expect(page.getByRole("menuitem", { name: "Why the market is up 2%" })).toHaveAttribute(
      "href",
      `/explain/${explanation.id}`,
    );

    await page.context().close();
  });
});

/** A signed-in learner whose only goal is `goal`'s, made with these fields, and active. */
async function createLearnerWithGoal(goal: Omit<Parameters<typeof goalFixture>[0], "userId">) {
  const user = await createE2EUser(getBaseURL());
  const created = await goalFixture({ timezone: "UTC", ...goal, userId: user.id });
  await learningProfileFixture({ activeGoalId: created.id, userId: user.id });
  return { goal: created, user };
}

test.describe("Journey without a plan yet", () => {
  test("follows the plan being built and opens the Journey on its own", async ({ browser }) => {
    const runId = `e2e-journey-${randomUUID()}`;

    const { goal, user } = await createLearnerWithGoal({
      details: { answered: [...ALL_ANSWERED] },
      generationRunId: runId,
      title: "Quantum physics",
    });

    const events: StreamEvent[] = [
      { entityId: goal.id, status: "started", step: "understandGoal" },
      { entityId: goal.id, status: "started", step: "buildSkillGraph" },
    ];

    const page = await openAs(browser, user);
    await followRun({ events, page, runId });
    await page.goto("/journey");

    await expect(
      page.getByRole("heading", { name: "Building your plan for Quantum physics" }),
    ).toBeVisible();

    await expect(page.locator('[data-slot="journey-preparing"]')).toBeVisible();
    await expectAccessibleScreen(page, "the Journey while its plan is built");

    // The run saves the plan: the stream says so and the path shows without a refresh.
    const plan = await planFixture({ goalId: goal.id, phases: [{ name: "Waves and particles" }] });
    await planItemFixture({ kind: "lesson", planId: plan.id, titleSnapshot: "What a wave is" });

    events.push(
      { entityId: goal.id, status: "completed", step: "buildSkillGraph" },
      { entityId: goal.id, status: "completed", step: "createPlan" },
    );

    await expect(journeyPath(page).locator(":scope > li").first()).toContainText(
      "Waves and particles",
    );

    await page.context().close();
  });

  test("a goal still in its questions leads back to them, and a quick explanation alone to a new goal", async ({
    browser,
  }) => {
    const { goal, user } = await createLearnerWithGoal({
      details: { answered: ["purpose"] },
      title: "Learn chemistry",
    });

    const page = await openAs(browser, user);
    await page.goto("/journey");

    await expect(
      page.getByRole("heading", { level: 1, name: "Your plan comes after a few questions" }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute(
      "href",
      `/start/${goal.id}`,
    );

    // A learner with only a quick explanation has no way to a goal to show: they start one.
    const explainer = await createLearnerWithGoal({
      kind: "explain",
      title: "Why the sky is blue",
    });

    const explainPage = await openAs(browser, explainer.user);
    await explainPage.goto("/journey");
    await expect(explainPage).toHaveURL(/\/start$/u);
    await explainPage.context().close();

    await page.context().close();
  });
});

test.describe("Plan reveal", () => {
  test("shows the plan's shape, what's on the exam and the path, says how much it covers, and switches to the time that covers it all in one tap", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
      const details = z.record(z.string(), z.unknown()).parse(goal.details ?? {});

      // Every question is answered, so onboarding opens on the plan, two months before the exam.
      await prisma.goal.update({
        data: {
          dailyMinutes: 10,
          details: { ...details, answered: [...ALL_ANSWERED] },
          targetDate: new Date(toUTCMidnight(new Date()).getTime() + 60 * MS_PER_DAY),
        },
        where: { id: goal.id },
      });

      await page.goto(`/start/${goal.id}`);

      await expect(
        page.getByRole("heading", { level: 1, name: "Your plan is ready" }),
      ).toBeVisible();

      await expect(page.getByText(/^\d+ days$/u)).toBeVisible();
      await expect(page.getByText("10 min a day", { exact: true })).toBeVisible();

      await expect(
        page.getByText(
          "10 min a day doesn't reach every topic: the ones that come up least are left out.",
        ),
      ).toBeVisible();

      // What's on her exam, the moment she decides to trust the plan: every subject of the
      // notice and its topics, her foreign language inside Linguagens, one tap away.
      await page.getByRole("button", { name: /^5 subjects from the notice\s*\d+ topics/u }).click();

      const structure = page.getByRole("dialog", { name: "What you'll study" });
      await structure.getByRole("button", { name: /^Matemática e suas Tecnologias/u }).click();

      await expect(
        structure.getByText("Conhecimentos de estatística e probabilidade", { exact: true }),
      ).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(structure).toBeHidden();

      // The path shows only its phases and the goal: nothing to open yet.
      const nodes = journeyPath(page).locator(":scope > li");
      await expect(nodes).toHaveCount(5);
      await expect(journeyPath(page).getByRole("button")).toHaveCount(0);
      await expect(journeyPath(page).getByRole("link")).toHaveCount(0);

      // One tap to the time plans recommend: everything in depth, or as much as a day can hold.
      const switchTime = page.getByRole("button", { name: /^Switch to .+ a day$/u });
      await switchTime.click();

      await expect(
        page.getByText(
          /^Done\. Your plan now covers your whole goal\.$|^.+ a day studies every topic of the exam, (?:the ones that come up most in more depth|some of them in less depth)\.$/u,
        ),
      ).toBeVisible();

      await expect
        .poll(async () => {
          const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
          return saved.dailyMinutes;
        })
        .toBeGreaterThan(10);

      await expect(page.getByRole("link", { name: "Start" })).toHaveAttribute("href", "/today");
    });
  });
});
