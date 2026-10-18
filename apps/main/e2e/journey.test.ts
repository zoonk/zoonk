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
import { REPLAN_TIMEOUT_MS } from "./plan-timeouts";
import { carryLessons, createStudyDay, openAs } from "./study-day";
import { routeTimeToCover } from "./time-to-cover-routes";

/**
 * The Plan replaces Plan, Progress and Content: where the learner stands in two
 * numbers (their details in sheets), the one thing the plan wants them to know or decide, the
 * phases as a roadmap, what's next on the path, the plan's settings, and the goal's subjects (or,
 * for a goal without them, its path of phases with the current one open to its chapters). The "…"
 * adjusts the plan and holds what's done now and then. `journey-syllabus.test.ts` covers subjects
 * in depth.
 */

const phasesSchema = z.array(z.object({ endDate: z.iso.date() }));

/** Every onboarding question, so `/start/{goalId}` opens on the plan. */
const ALL_ANSWERED = [...ONBOARDING_QUESTIONS, "buddy", "placement"];

const STATUS =
  /Pace\s*(?:On pace|Ahead|Behind|Too tight)\s*(?:.+ a day|Needs adjusting|One day (?:ahead|behind)|\d+ days (?:ahead|behind)|\d+ lessons? to catch up)/u;

/** A preset's time as the editor writes it: "45 min", "1 hr", "1 hr 30 min". */
function minutesLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) {
    return `${rest} min`;
  }

  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** The editor's one-hour preset: no chip says what it covers until the learner asks Find. */
const ONE_HOUR = /^1 hr$/u;

/** A list row's least height: a tap target with room for its title. */
const MIN_ROW_HEIGHT = 44;

async function openJourney(page: Page) {
  await page.goto("/plan");
  await expect(page.locator('[data-slot="journey"]')).toBeVisible();
}

function journeyPath(page: Page) {
  return page.getByRole("list", { name: "Your path" });
}

/** The two numbers, drawn as tiles under 72rem and in the aside from it: the one on screen. */
function standingNumbers(page: Page) {
  return page.locator('[data-slot="journey-standing"]').filter({ visible: true });
}

/** The Plan's one suggestion, as the aside's panel at the tests' desktop width. */
function suggestionPanel(page: Page) {
  return page.locator('[data-slot="suggestion-panel"]').filter({ visible: true });
}

/**
 * "Adjust plan" beside the Plan's title. A plan that no longer fits offers one in its suggestion
 * too, so it's the one in the page's column.
 */
function adjustPlanButton(page: Page) {
  return page.locator('[data-slot="journey"]').getByRole("button", { name: "Adjust plan" });
}

/**
 * The roadmap's day labels under its bands (today, each phase's first day, the exam's day, the
 * road's end), left to right.
 */
async function readRoadmapAxis(page: Page) {
  const labels = await page
    .locator('[data-slot="plan-roadmap"]')
    .filter({ visible: true })
    .locator(":scope > ol > li")
    .evaluateAll((phases) =>
      phases.flatMap((phase) =>
        // Only the labels the axis shows: a band too short for one leaves it out of the layout.
        [...(phase.lastElementChild?.children ?? [])]
          .filter((label) => label.getClientRects().length > 0)
          .map((label) => ({
            text: label.textContent ?? "",
            x: label.getBoundingClientRect().left,
          })),
      ),
    );

  return labels.toSorted((first, second) => first.x - second.x).map((label) => label.text);
}

/** "Choose where to focus", one of the coverage suggestion's other options. */
async function chooseFocusFromPlan(page: Page) {
  await suggestionPanel(page).getByRole("button", { name: "Other options" }).click();
  await page.getByRole("menuitem", { name: "Choose where to focus" }).click();
}

async function openMenu(page: Page) {
  await page.getByRole("button", { name: "Plan options" }).click();
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

      // Two numbers: her preparation and her pace, each a button to what's behind it.
      const standing = standingNumbers(page);
      await expect(standing).toContainText(/^Preparation\s*\d+%/u);
      await expect(standing).toContainText(STATUS);
      const hero = standing.getByRole("button", { name: /^Preparation/u });

      // The roadmap: every phase as a band as long as its days, the one she's in raised.
      const roadmap = page.getByRole("region", { exact: true, name: "Phases" });
      const bands = roadmap.locator('[data-slot="roadmap-band"]');
      await expect(bands).toHaveCount(4);
      await expect(bands.first()).toContainText("Foundations");
      await expect(roadmap.locator('[aria-current="step"]')).toContainText(", you are here");

      // Its band is named in one run, never "Foundations , you are here".
      await expect(roadmap.locator('[aria-current="step"]')).toHaveAccessibleName(
        /\S, you are here$/u,
      );

      // A band opens what its phase holds: its dates and lessons, its mocks and its challenge.
      await bands.nth(1).click();
      const phase = page.getByRole("dialog", { name: "Fill the gaps" });
      await expect(phase).toContainText(/\d+ of \d+ lessons?/u);
      await page.keyboard.press("Escape");
      await expect(phase).toBeHidden();

      // What's next on her path, three rows to act on: her next mock, the challenge that closes
      // the phase she's in, and the exam itself, which opens what's on it. Chapters live under her
      // exam's subjects.
      const next = page.getByRole("region", { name: "Next on your path" });

      // Her next mock is long and the plan already saves time for it, so it opens its own intro
      // (funded-mock.test.ts follows it); a mock without saved time opens what's on her exam.
      await expect(next.getByRole("link", { name: /^Mock exam/u })).toHaveAttribute(
        "href",
        /^\/challenge\/[\da-f-]{36}$/u,
      );

      await expect(next.getByRole("link", { name: /^Phase challenge/u })).toHaveAttribute(
        "href",
        /^\/challenge\/[\da-f-]{36}$/u,
      );

      await expect(next.getByRole("link").last()).toHaveAttribute("href", "/exam");
      await expect(page.getByText("Up next", { exact: true })).toHaveCount(0);

      // Her plan's settings at a glance beside it, each opening "Adjust plan" at itself.
      const settings = page.getByRole("region", { exact: true, name: "Your plan" });
      await expect(settings.getByRole("button", { name: /^Time a day/u })).toBeVisible();
      await expect(settings.getByRole("button", { name: /^Study days/u })).toBeVisible();

      // The subjects: the notice's subjects in its words, each opening its page, with the foreign
      // language she takes inside Linguagens, as the notice counts it.
      const syllabus = page.getByRole("region", { exact: true, name: "Subjects" });
      await expect(syllabus.getByText(/^5 subjects · \d+ topics/u)).toBeVisible();

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
      // from Today (and the notebook opens from the sidebar too), not from the Plan's page.
      await expect(
        page.getByRole("main").getByRole("link", { name: /^Mistakes notebook/u }),
      ).toHaveCount(0);

      await expect(page.getByRole("link", { name: /^Take a mock exam/u })).toHaveCount(0);
      await expect(page.getByRole("region", { name: "This week" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: /^Weekly summary/u })).toHaveCount(0);
      await expect(page.getByRole("textbox", { name: /Search/u })).toHaveCount(0);

      await expectAccessibleScreen(page, "the Plan");

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

      // "Adjust plan" sits beside the title; the "…" after it holds what's done now and then.
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
      await expect(page).toHaveURL(/\/plan\/matematica-e-suas-tecnologias$/u);

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

      // A chapter's way back is the subject it was opened from; the subject's is the Plan.
      await chapter.click();
      const back = page.getByRole("main").getByRole("link", { name: "Back to Matemática" });
      await expect(back).toHaveAttribute("href", "/plan/matematica-e-suas-tecnologias");
      await back.click();

      await page.getByRole("main").getByRole("link", { name: "Back to Plan" }).click();
      await expect(page).toHaveURL(/\/plan$/u);
    });
  });

  // Ana's sheet read 91% Mastery beside a headline that counted about 68%, "3 of 35 skills" beside
  // a ring weighted another way, and "29 skills to go" counting a third thing.
  test("the preparation sheet's rings and rows read what the headline counts", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page }) => {
      await openJourney(page);
      const preparation = standingNumbers(page).getByRole("button", { name: /^Preparation/u });
      await preparation.click();
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
      // count of skills beside Coverage's. Hundreds of hours read in whole hours: "About 231 hr
      // 37 min" was a precision no estimate has.
      await expect(
        sheet.getByRole("region", { name: "Still to do" }).getByRole("listitem"),
      ).toHaveText([
        /^Get the topics that weigh most to Solid\s*About \d+\shr in your plan$/u,
        /^Keep what you studied fresh\s*\d+ skills? fading, back in your reviews$/u,
      ]);
    });
  });

  // At 1180 px Ana's mock exams row read "Aos domingos, a cada 4 semar", cut mid-word with no
  // ellipsis: the aside is narrow there. Every setting's value shows whole, wrapping if it must.
  test("the plan's settings show their values whole in a narrow aside", async ({ browser }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page }) => {
      await page.setViewportSize({ height: 820, width: 1180 });
      await page.goto("/pt/plan");
      await expect(page.locator('[data-slot="journey"]')).toBeVisible();

      const values = page
        .locator('[data-slot="plan-properties"]')
        .filter({ visible: true })
        .locator("li > * > span:last-child");

      await expect(values.first()).toBeVisible();

      const cut = await values.evaluateAll((spans) =>
        spans
          .filter(
            (span) => span.scrollWidth > span.clientWidth || span.scrollHeight > span.clientHeight,
          )
          .map((span) => span.textContent),
      );

      expect(cut).toStrictEqual([]);
    });
  });

  test("the old tabs and the subject map lead to the Journey", async ({ browser }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page }) => {
      // The old pages answer with a redirect, so following each one ends on the Plan.
      const landed = await Promise.all(
        ["/plan", "/progress", "/content", "/content/map"].map(async (path) => {
          const response = await page.request.get(path);
          return new URL(response.url()).pathname;
        }),
      );

      expect(landed).toStrictEqual(["/plan", "/plan", "/plan", "/plan"]);

      await page.goto("/pt/plan");
      await expect(page).toHaveURL(/\/pt\/plan$/u);
      await expect(page.locator("#plan-title")).toBeVisible();
    });
  });

  test("a plan that doesn't fit says how much it covers, and the editor fixes it, from the keyboard too", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      // The exam moved two months away, and Ana cut her time to 15 minutes a day in the editor,
      // which plans again (a time written to the database would leave her old plan in place).
      const targetDate = new Date(toUTCMidnight(new Date()).getTime() + 60 * MS_PER_DAY);

      await prisma.goal.update({ data: { targetDate }, where: { id: user.goalId } });

      // Until it plans again, her plan no longer fits, and the Plan's suggestion says so with an
      // "Adjust plan" of its own. Its road keeps its own end, with the exam's day where the exam
      // falls on it, so its days read in order and show how far past the exam it runs.
      await openJourney(page);
      const runningPast = await readRoadmapAxis(page);
      expect(runningPast.some((label) => label.endsWith("· exam"))).toBe(true);
      expect(runningPast.at(-1)).not.toContain("exam");

      await adjustPlanButton(page).click();
      const editor = page.getByRole("dialog", { name: "Adjust your plan" });
      const minutes = editor.getByRole("radiogroup", { name: "Time a day" });

      // A preset is picked by tapping its time: its radio, invisible over it, lets the tap through.
      await minutes.getByText("15 min", { exact: true }).click();

      await expect(
        editor.getByRole("status").filter({ hasText: "Daily time changed to 15 min." }),
      ).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });

      await editor.getByRole("button", { name: "Close" }).click();
      await expect(editor).toBeHidden();

      // Planned again, the road ends at the exam. A last band narrower than 8rem drops the
      // "· exam" suffix to keep its dates apart; its flag and the legend still name the exam.
      const examDate = new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(targetDate);

      await expect
        .poll(async () => {
          const axis = await readRoadmapAxis(page);
          return axis.at(-1)?.replace(/ · exam$/u, "");
        })
        .toBe(examDate);

      await expect(page.getByText("Exam day", { exact: true })).toBeVisible();

      const replanned = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });
      const replannedPhases = phasesSchema.parse(replanned.phases);

      expect(replannedPhases.at(-1)?.endDate).toBe(
        new Date(targetDate.getTime() - MS_PER_DAY).toISOString().slice(0, 10),
      );

      // Fifteen minutes don't cover it all: the Plan's one suggestion says exactly what they cover,
      // and works out the time that covers everything only when she asks (no searched time on a
      // page, so nothing to read before she taps).
      const suggestion = suggestionPanel(page);

      await expect(suggestion.getByRole("heading")).toHaveText(
        /^15\smin a day (?:doesn't reach every topic|studies every topic of the exam)/u,
      );

      await expect(
        suggestion.getByRole("button", { name: "Find the time that covers everything" }),
      ).toBeVisible();

      await expect(
        suggestion.getByText(/a day covers (?:everything|about \d+%) in depth/u),
      ).toHaveCount(0);

      await expect(page.getByText(/^To study every topic:/u)).toHaveCount(0);

      // The buddy's "Choose where to focus" opens the Plan with the sheet open; Esc closes it.
      await page.goto("/plan?focus=choose");
      await expect(page.getByRole("dialog", { name: "Where to focus" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Where to focus" })).toBeHidden();

      // Where her few minutes go is hers to choose, from the suggestion's other options: the sheet
      // says what the focus did, with an undo, before it closes.
      await chooseFocusFromPlan(page);
      const focus = page.getByRole("dialog", { name: "Where to focus" });

      await focus.getByRole("checkbox", { name: "Matemática" }).click();
      await focus.getByRole("button", { name: "Focus on these" }).click();

      await expect(focus.getByRole("status")).toContainText("More time for");
      await expect(focus.getByRole("status")).toContainText("Matemática");
      await expect(focus.getByRole("button", { name: "Undo" })).toBeVisible();
      await focus.getByRole("button", { name: "Done" }).click();
      await expect(focus).toBeHidden();

      await expect.poll(() => loadFocusAreas(user.goalId)).toContain("Matemática");

      await adjustPlanButton(page).click();

      // No preset says what it covers until she asks: Find sits under them.
      await expect(
        minutes.getByRole("radio", { name: /(?:Covers everything|About \d+%)$/u }),
      ).toHaveCount(0);

      await expect(
        editor.getByRole("button", { name: "Find the time that covers everything" }),
      ).toBeVisible();

      await expectAccessibleScreen(page, "the plan editor");

      await minutes.getByText("1 hr", { exact: true }).click();

      // While the new time plans again, the old time's coverage doesn't stay under it: its place
      // says what the new one covers is being worked out.
      const workingOut = editor.getByText("Working out what your time covers…");
      await expect(workingOut).toBeVisible();

      await expect
        .poll(async () => {
          const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
          return goal.dailyMinutes;
        })
        .toBe(60);

      // What the new time covers shows right under it, once it's planned.
      await expect(workingOut).toBeHidden({ timeout: REPLAN_TIMEOUT_MS });

      await expect(
        editor.getByText(
          /^(?<coverage>Covers your whole goal\.|1\shr a day (?<reach>studies every topic|doesn't reach every topic))/u,
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
      await adjustPlanButton(page).click();
      await expect(minutes.getByRole("radio", { name: ONE_HOUR })).toBeChecked();
    });
  });

  test("the Plan's suggestion keeps the keyboard's place through Apply and Undo, and its result stays while the learner is on it", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      // Two months to her exam at 15 minutes a day: the Plan finds the time that covers it all.
      const examDate = new Date(toUTCMidnight(new Date()).getTime() + 60 * MS_PER_DAY);
      await prisma.goal.update({ data: { targetDate: examDate }, where: { id: user.goalId } });

      // Main's E2E runs without the API: Find finds that an hour a day covers everything.
      const asked = await routeTimeToCover(page, {
        goalId: user.goalId,
        time: { recommendedMinutes: 60, targetDate: examDate.toISOString().slice(0, 10) },
      });

      await page.clock.install();
      await openJourney(page);
      await adjustPlanButton(page).click();
      const editor = page.getByRole("dialog", { name: "Adjust your plan" });
      await editor.getByRole("radiogroup", { name: "Time a day" }).getByText("15 min").click();

      await expect(
        editor.getByRole("status").filter({ hasText: "Daily time changed to 15 min." }),
      ).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });

      await editor.getByRole("button", { name: "Close" }).click();
      await expect(editor).toBeHidden();

      const panel = suggestionPanel(page);
      const suggestion = page.locator('[data-slot="suggestion"]').filter({ visible: true });
      const find = panel.getByRole("button", { name: "Find the time that covers everything" });
      await expect(panel.getByRole("heading")).toHaveText(/^15\smin a day /u);

      // One tap on Find finds the time and shows what it changes.
      await find.click();

      await expect(panel.getByRole("heading")).toHaveText(/a day covers .+ in depth$/u, {
        timeout: REPLAN_TIMEOUT_MS,
      });

      const apply = panel.getByRole("button", { name: "Apply" });
      await expect(apply).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });
      await apply.focus();
      await page.keyboard.press("Enter");

      // Apply gives way to what it did: the suggestion takes the keyboard, not the page.
      await expect(panel.getByRole("heading")).toHaveText("Plan updated");
      await expect(suggestion).toBeFocused();

      // Past the moment a result usually stays, it's still there while Undo has the keyboard.
      const undo = panel.getByRole("button", { name: "Undo" });
      await undo.focus();
      await page.clock.fastForward(20_000);
      await expect(undo).toBeFocused();

      // Undo puts the plan back and the suggestion with it: the time Find found for this plan comes
      // back too (no second search), and the keyboard lands on it.
      await page.keyboard.press("Enter");
      await expect(panel.getByRole("heading")).toHaveText(/a day covers .+ in depth$/u);
      await expect(panel.getByRole("button", { name: "Preview" })).toBeVisible();
      await expect(find).toHaveCount(0);
      await expect(suggestion).toBeFocused();
      expect(asked).toHaveLength(1);
    });
  });

  test("a paused goal has no pace to keep, so its pace sheet offers nothing to catch up", async ({
    browser,
  }) => {
    const { goal, user } = await createStudyDay();
    await carryLessons({ count: 2, goalId: goal.id });

    const page = await openAs(browser, user);
    await openJourney(page);

    // Behind, the sheet says what comes first.
    await expect(
      standingNumbers(page).getByRole("button", { name: /^Pace Behind/u }),
    ).toBeVisible();

    await prisma.goal.update({ data: { status: "paused" }, where: { id: goal.id } });
    await openJourney(page);

    await standingNumbers(page)
      .getByRole("button", { exact: true, name: "Pace Paused Nothing is planned" })
      .click();

    const sheet = page.getByRole("dialog", { name: "Your pace" });
    await expect(sheet.getByText("Paused", { exact: true })).toBeVisible();
    await expect(sheet.getByText("Nothing is planned until you resume it.")).toBeVisible();
    await expect(sheet.getByText(/catch up|keeping pace again/u)).toHaveCount(0);

    await page.context().close();
  });

  test("a goal no daily time covers by its date finds what the most time reaches when asked, and moves the date to cover it all", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      // Marcos's move came forward to a month away: even the most time a day can't cover his goal.
      const targetDate = new Date(toUTCMidnight(new Date()).getTime() + 30 * MS_PER_DAY);
      await prisma.goal.update({ data: { targetDate }, where: { id: user.goalId } });

      // Main's E2E runs without the API: Find finds no daily time covers it by his date, what the
      // most time a day would reach, and a date a year later that his own time covers it all by.
      const fittingDate = new Date(targetDate.getTime() + 365 * MS_PER_DAY);

      await routeTimeToCover(page, {
        goalId: user.goalId,
        time: {
          fittingDate: fittingDate.toISOString().slice(0, 10),
          maximum: { coveredShare: 0.37, dailyMinutes: 240 },
          measure: "goal",
          targetDate: targetDate.toISOString().slice(0, 10),
        },
      });

      await openJourney(page);

      // The plan he had no longer fits the month left, which the Plan's suggestion says first. The
      // next one says exactly what his time covers, and works out the rest only when he asks.
      const suggestion = suggestionPanel(page);
      await expect(suggestion.getByRole("heading")).toHaveText("Your plan no longer fits");
      const slot = page.getByRole("group", { name: "Plan suggestion" });
      const next = slot.getByRole("button", { exact: true, name: "Next" });
      const previous = slot.getByRole("button", { exact: true, name: "Previous" });

      await next.focus();
      await next.press("Enter");
      await expect(next).toBeFocused();

      const honest =
        /^Even at .+ a day, you'd study about \d+% of everything in depth by your date\.$/u;

      await expect(suggestion.getByRole("heading")).toHaveText(
        / a day (?:doesn't reach|studies) /u,
      );

      await expect(suggestion.getByText(honest)).toHaveCount(0);

      // Find finds that no daily time covers it all: the date his own time covers it by is the
      // offer, with what the most time a day would reach, and no time to switch to.
      await suggestion
        .getByRole("button", { name: "Find the time that covers everything" })
        .click();

      await expect(suggestion.getByRole("heading")).toHaveText(
        /^Your time covers everything by /u,
        { timeout: REPLAN_TIMEOUT_MS },
      );

      await expect(suggestion.getByText(honest)).toBeVisible();
      await expect(suggestion.getByRole("button", { name: /^Switch to/u })).toHaveCount(0);

      // The answer stays with the plan it was found for while he pages through the suggestions.
      await previous.focus();
      await previous.press("Enter");
      await expect(suggestion.getByRole("heading")).toHaveText("Your plan no longer fits");
      await expect(previous).toBeFocused();
      await next.press("Enter");
      await expect(suggestion.getByRole("heading")).toHaveText(/^Your time covers everything by /u);

      await adjustPlanButton(page).click();
      const editor = page.getByRole("dialog", { name: "Adjust your plan" });

      // The editor has the same answer: the most time a day says what it covers, and moving the
      // date is the one way to cover everything.
      await expect(
        editor
          .getByRole("radiogroup", { name: "Time a day" })
          .getByRole("radio", { name: /^4 hr\s*About \d+%$/u }),
      ).toBeVisible();

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
      await chooseFocusFromPlan(page);
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
      await chooseFocusFromPlan(page);
      const focus = page.getByRole("dialog", { name: "Where to focus" });

      // Linguagens' row names its parts, so only a row of English's own starts with its name.
      await expect(focus.getByRole("checkbox", { name: /^Língua Inglesa/u })).toHaveCount(0);
      await expect(focus.getByText("Includes Língua Inglesa")).toBeVisible();
      // Each checkbox goes by its row's words, said once.
      await expect(focus.getByRole("checkbox", { exact: true, name: "Matemática" })).toBeVisible();

      await focus.getByRole("checkbox", { name: "Linguagens" }).click();

      // It says what the focus did once the plan is made again, which can take a while: until
      // then its action says it's saving, and the picks stay as they're saved. The save waits here
      // until the sheet has said so.
      const saving = Promise.withResolvers<boolean>();

      await page.route(
        (url) => url.pathname === "/plan",
        async (route) => {
          if (route.request().postData()?.includes('"focusAreas"')) {
            await saving.promise;
          }

          await route.fallback();
        },
      );

      await focus.getByRole("button", { name: "Focus on these" }).click();
      await expect(focus.getByRole("button", { name: "Saving…" })).toBeDisabled();
      await expect(focus.getByRole("checkbox", { name: "Linguagens" })).toBeDisabled();
      saving.resolve(true);

      const status = focus.getByRole("status");

      await expect(status).toContainText("More time for Ciências da Natureza and Linguagens.", {
        timeout: REPLAN_TIMEOUT_MS,
      });

      await expect(status).not.toContainText("Língua Inglesa");
      await focus.getByRole("button", { name: "Done" }).click();
      await expect(focus).toBeHidden();

      await expect
        .poll(() => loadFocusAreas(user.goalId))
        .toStrictEqual(["Ciências da Natureza", "Linguagens", "Língua Inglesa"]);

      // Taking Linguagens out of her focus takes her English out with it.
      await chooseFocusFromPlan(page);
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

      // The weekdays change on their own, and the weekend keeps what she gave it. The editor saves
      // one change at a time: the weekend's is saved before the page shows it.
      const minutes = editor.getByRole("radiogroup", { name: "Time a day" });

      // The presets are busy while a change saves, and a tap on them then does nothing.
      const presets = editor.locator("[aria-busy]", {
        has: page.getByRole("radiogroup", { name: "Time a day" }),
      });

      await expect(presets).toHaveAttribute("aria-busy", "false");
      await minutes.getByText("45 min", { exact: true }).click();

      await expect.poll(loadWeek).toStrictEqual([120, ...weekdays.map(() => 45), 120]);

      await expect(toggle).toBeChecked();

      // Switched off once the change is saved, the weekend goes back to the weekdays' new time.
      await expect(minutes.getByRole("radio", { name: /^45 min/u })).toBeChecked();
      await expect(presets).toHaveAttribute("aria-busy", "false");
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

      const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
      const ownTime = minutesLabel(goal.dailyMinutes);
      const own = new RegExp(`^${ownTime}(?:\\s|$)`, "u");
      const otherTime = goal.dailyMinutes === 15 ? "30 min" : "15 min";

      await openJourney(page);
      await page.getByRole("button", { name: "Adjust plan" }).click();
      const editor = page.getByRole("dialog", { name: "Adjust your plan" });
      const minutes = editor.getByRole("radiogroup", { name: "Time a day" });
      const before = await loadPlanItems();

      await minutes.getByText(otherTime, { exact: true }).click();

      // The editor says what the change did, by its controls, with a way back, once the plan is
      // made again.
      await expect(
        editor.getByRole("status").filter({ hasText: `Daily time changed to ${otherTime}.` }),
      ).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });

      await editor.getByRole("button", { name: "Undo" }).click();

      await expect(
        editor.getByRole("status").filter({ hasText: "Undone. Your plan is back as it was." }),
      ).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });

      await expect(minutes.getByRole("radio", { name: own })).toBeChecked();
      await expect(editor.getByRole("button", { name: "Undo" })).toHaveCount(0);
      await expect.poll(loadPlanItems).toStrictEqual(before);

      // Setting the old time back by hand is the same Undo, not a plan made again.
      await minutes.getByText(otherTime, { exact: true }).click();

      await expect(
        editor.getByRole("status").filter({ hasText: `Daily time changed to ${otherTime}.` }),
      ).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });

      await minutes.getByText(ownTime, { exact: true }).click();

      await expect(
        editor.getByRole("status").filter({ hasText: "Undone. Your plan is back as it was." }),
      ).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });

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
      await expect(page).toHaveURL(/\/plan$/u);
    });
  });

  test("a huge goal without a date ends about when its plan does, and questions about the plan go to the buddy", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });

      const phases = phasesSchema.parse(plan.phases);

      // The Plan writes an estimate by its short month, with the year when it's a year away.
      const toMonth = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });

      // "About" its last phase's end: the graph sizes the end (lessons of the average length), so it
      // can land days before the end the seed's longer hand-written lessons give its phases.
      const end = new Date(phases.at(-1)?.endDate ?? "");
      const daysBefore = new Date(end.getTime() - 14 * MS_PER_DAY);
      const months = [end, daysBefore].map((date) => toMonth.format(date));

      await openJourney(page);

      const nodes = journeyPath(page).locator(":scope > li");
      const about = new RegExp(`About (?:${months.join("|")})(?: \\d{4})?`, "u");
      await expect(nodes).toHaveCount(phases.length + 1);
      await expect(nodes.last()).toContainText(about);

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

      // The road ends at the exam, its day to be confirmed: no "About Sep 2027" beside it, which
      // is when the plan ends, not the exam's day.
      const finish = page
        .getByRole("region", { name: "Next on your path" })
        .getByRole("link")
        .last();

      await expect(finish).toHaveAttribute("href", "/exam");
      await expect(finish).toContainText("Date to be confirmed");
      await expect(finish.getByText(/About [A-Z]/u)).toHaveCount(0);

      // Its last phase says when the plan ends: its band on the roadmap opens its days.
      await page
        .getByRole("region", { exact: true, name: "Phases" })
        .locator('[data-slot="roadmap-band"]')
        .last()
        .click();

      await expect(page.getByRole("dialog")).toContainText(/ – [A-Z][a-z]{2} \d{1,2}/u);
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

  // On Ana's phone, "Adjust" acted from the line and the pager waited in a sheet that never
  // opened: her plan's second suggestion stayed out of reach until she changed her plan.
  test("on a phone, a suggestion that acts from its line still leads to the next one", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      await prisma.goal.update({
        data: { targetDate: new Date(toUTCMidnight(new Date()).getTime() + 60 * MS_PER_DAY) },
        where: { id: user.goalId },
      });

      await page.setViewportSize({ height: 844, width: 390 });
      await openJourney(page);
      const slot = page.locator('[data-slot="plan-suggestion"]').filter({ visible: true });
      const pager = slot.locator('[data-slot="suggestion-pager"]').filter({ visible: true });

      await expect(slot).toContainText("Your plan no longer fits in the time left.");
      await expect(slot.getByRole("button", { exact: true, name: "Adjust" })).toBeVisible();
      await expect(pager).toHaveText(/1 of 2/u);

      await pager.getByRole("button", { name: "Next" }).click();
      await expect(pager).toHaveText(/2 of 2/u);
      await expect(pager.getByRole("button", { name: "Next" })).toBeFocused();

      // The next one says what her own time covers, as the plan has it: no other time is searched
      // for the page.
      // Any character for the apostrophe: Playwright can't chain a locator named by a pattern
      // that holds one.
      const ownTime = /45\smin a day (?:doesn.t reach|studies) every topic/u;
      await expect(slot).toContainText(ownTime);

      // The sheet holds the one suggestion it opened for: moving on happens under the line.
      await slot.getByRole("button", { exact: true, name: "View" }).click();
      const sheet = page.getByRole("dialog", { name: ownTime });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole("button", { exact: true, name: "Next" })).toHaveCount(0);
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
  // set its other lessons aside, and her Plan marked the phase done. The plan moves on to the
  // next phase, and the one it left says how far she got, never a check.
  test("a phase whose lessons were set aside after days away isn't marked done", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());

    // Missed days set lessons aside only in a plan with a date to fit them by.
    const [goal, chapters] = await Promise.all([
      goalFixture({
        targetDate: toUTCMidnight(new Date(Date.now() + 60 * MS_PER_DAY)),
        timezone: "UTC",
        title: "Learn ratios",
        userId: user.id,
      }),
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
    // Under its name, why it isn't checked: what the missed days set aside.
    await expect(left.getByText("1 lesson was left out", { exact: true })).toBeVisible();
    await expect(left).not.toContainText(", done");

    await expect(path.locator(':scope > li[aria-current="step"]')).toContainText("Rates");
    await expect(page.getByText("phase 2 of 2").filter({ visible: true })).toBeVisible();

    await page.context().close();
  });

  // Pedro moved his date and Lucas took his past-date offer while their Plans stayed open: each
  // path kept the phase it first opened and left the one the plan goes on in shut until a reload.
  // Switching goals on the Plan shows it every time: the path is the same list for every goal.
  test("the path opens the phase where the plan goes on, switching goals included", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());

    /** A goal whose plan has two phases of two chapters, its next chapter in phase `next`. */
    const pathGoal = async ({ next, title }: { next: 0 | 1; title: string }) => {
      const [goal, chapters] = await Promise.all([
        goalFixture({ timezone: "UTC", title, userId: user.id }),
        Promise.all(
          ["one", "two", "three", "four"].map((name) =>
            libraryChapterFixture({ title: `${title}: ${name}` }),
          ),
        ),
      ]);

      const plan = await planFixture({
        goalId: goal.id,
        phases: [{ name: `${title} basics` }, { name: `${title} in depth` }],
      });

      await Promise.all(
        chapters.map((chapter, position) =>
          planItemFixture({
            chapterId: chapter.id,
            phase: position < 2 ? 0 : 1,
            planId: plan.id,
            position,
            status: position < next * 2 ? "done" : "todo",
          }),
        ),
      );

      return goal;
    };

    const ratios = await pathGoal({ next: 1, title: "Ratios" });
    await pathGoal({ next: 0, title: "Rates" });

    await Promise.all([
      learningProfileFixture({ activeGoalId: ratios.id, userId: user.id }),
      studySessionFixture({ goalId: ratios.id, userId: user.id }),
    ]);

    const page = await openAs(browser, user);
    await openJourney(page);
    const path = journeyPath(page);

    // Ratios goes on in its second phase, open to its chapters.
    await expect(path.getByRole("link", { name: /Ratios: three/u })).toBeVisible();

    await page.getByRole("button", { name: /^Current goal: Ratios/u }).click();
    await page.getByRole("menuitemradio", { name: /Rates/u }).click();

    // Rates goes on in its first phase: that one opens, its second stays shut.
    await expect(path.getByRole("link", { name: /Rates: one/u })).toBeVisible();
    await expect(path.getByRole("link", { name: /Rates: three/u })).toBeHidden();

    await page.context().close();
  });

  // Pedro's first phase, shut while his next lesson sat in the second, read "Lessons done ·
  // challenge Oct 21" beside "3 / 7": its other lessons came later in the plan. Only a phase whose
  // lessons are all done says so.
  test("a phase the plan comes back to later never says its lessons are done", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());

    const [goal, chapters] = await Promise.all([
      goalFixture({ timezone: "UTC", title: "Learn ratios", userId: user.id }),
      Promise.all(
        ["Ratios", "Rates", "Proportions"].map((title) => libraryChapterFixture({ title })),
      ),
    ]);

    const [plan] = await Promise.all([
      planFixture({ goalId: goal.id, phases: [{ name: "Ratio basics" }, { name: "Motion" }] }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
      studySessionFixture({ goalId: goal.id, userId: user.id }),
    ]);

    // Ratios done; next, Rates in the second phase; then the first phase's Proportions and its
    // challenge, later.
    const [ratios, rates, proportions] = chapters;

    await Promise.all([
      planItemFixture({
        chapterId: ratios?.id,
        phase: 0,
        planId: plan.id,
        position: 0,
        status: "done",
      }),
      planItemFixture({ chapterId: rates?.id, phase: 1, planId: plan.id, position: 1 }),
      planItemFixture({ chapterId: proportions?.id, phase: 0, planId: plan.id, position: 2 }),
      planItemFixture({
        kind: "boss",
        phase: 0,
        planId: plan.id,
        position: 3,
        scheduledFor: toUTCMidnight(new Date(Date.now() + 8 * MS_PER_DAY)),
        titleSnapshot: "Challenge 1",
      }),
    ]);

    const page = await openAs(browser, user);
    await openJourney(page);

    const first = journeyPath(page).locator(":scope > li").first();
    await expect(first).toContainText("1 of 2 lessons done");
    await expect(first).not.toContainText("Lessons done");

    await page.context().close();
  });

  // Pedro finished his plan: its pace reads "Finished", never days ahead of dates it no longer
  // needs, on the Plan, its pace sheet and Today, and a pause doesn't change it.
  test("a finished plan keeps its finished pace when paused", async ({ browser }) => {
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
      (["testedOut", "done"] as const).map((status, position) =>
        planItemFixture({ chapterId: chapters[position]?.id, planId: plan.id, position, status }),
      ),
    );

    const page = await openAs(browser, user);
    await openJourney(page);

    await expect(page.getByRole("region", { name: "You finished your plan" })).toBeVisible();

    const paceButton = page.getByRole("button", { exact: true, name: "Pace Finished" });
    await expect(paceButton).toBeVisible();
    await paceButton.click();
    const sheet = page.getByRole("dialog", { name: "Your pace" });
    await expect(sheet.getByText("Plan finished", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    // Today's eyebrow and the pace sheet read the same core status.
    await page.goto("/today");
    await expect(page.getByText(/Plan finished/u)).toBeVisible();

    // A paused goal still keeps its completed plan's truthful pace on a return visit.
    await prisma.goal.update({ data: { status: "paused" }, where: { id: goal.id } });
    await page.setViewportSize({ height: 844, width: 390 });
    await openJourney(page);
    await expect(paceButton).toBeVisible();
    await paceButton.click();
    await expect(sheet.getByText("Plan finished", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.context().close();
  });

  test("a learn goal's progress counts weekly challenges, and a quick explanation has no Journey", async ({
    browser,
  }) => {
    const { chapter, explanation, user } = await createLearnAndExplainLearner();
    const page = await openAs(browser, user);
    await openJourney(page);

    // A goal learned for its own sake reads as a share of the way, never as exam preparation.
    const standing = standingNumbers(page);
    await expect(standing).toContainText(/^Progress\s*0%/u);
    await expect(standing).not.toContainText(/preparation/iu);
    const hero = standing.getByRole("button", { name: /^Progress/u });

    // The chapter up next is the path's highlighted row: no chip says it again.
    const row = journeyPath(page).getByRole("link", { name: /Percentages/u });
    await expect(row).toHaveAttribute("href", `/content/chapters/${chapter.id}`);
    await expect(row.locator("xpath=ancestor::li[1]")).toHaveAttribute("aria-current", "step");
    await expect(row).not.toContainText("Up next");

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
    await page.goto("/plan");

    // The Plan keeps its title while it's built; its eyebrow says so.
    await expect(page.getByRole("heading", { level: 1, name: "Plan" })).toBeVisible();
    await expect(page.getByText("Quantum physics · Building your plan")).toBeVisible();

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
    await page.goto("/plan");

    // The page keeps its title; its questions are the one way to its plan.
    await expect(page.getByRole("heading", { level: 1, name: "Plan" })).toBeVisible();

    await expect(
      page.getByRole("heading", { level: 2, name: "Your plan comes after a few questions" }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute(
      "href",
      `/start/${goal.id}`,
    );

    // A learner with only a quick explanation has no plan to show: the Plan stays, and they
    // start a goal right there.
    const explainer = await createLearnerWithGoal({
      kind: "explain",
      title: "Why the sky is blue",
    });

    const explainPage = await openAs(browser, explainer.user);
    await explainPage.goto("/plan");
    await expect(explainPage).toHaveURL(/\/plan$/u);
    await expect(explainPage.getByRole("heading", { level: 1, name: "Plan" })).toBeVisible();
    await expect(explainPage.getByRole("textbox", { name: "I want to" })).toBeVisible();
    await explainPage.context().close();

    await page.context().close();
  });
});

test.describe("Plan reveal", () => {
  test("shows the plan's shape, what's on the exam and the path, and says exactly how much it covers", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
      const details = z.record(z.string(), z.unknown()).parse(goal.details ?? {});

      // Every question is answered, so onboarding opens on the plan, two months before the exam.
      // A new time and date are new inputs for her plan, as a learner's change makes them, so it
      // plans again for them instead of keeping the one she was shown.
      await prisma.goal.update({
        data: {
          dailyMinutes: 10,
          details: { ...details, answered: [...ALL_ANSWERED] },
          targetDate: new Date(toUTCMidnight(new Date()).getTime() + 60 * MS_PER_DAY),
        },
        where: { id: goal.id },
      });

      await prisma.plan.update({
        data: { inputVersion: { increment: 1 } },
        where: { goalId: goal.id },
      });

      await page.goto(`/start/${goal.id}`);

      await expect(page.getByText("Plan created", { exact: true })).toBeVisible();

      await expect(page.getByText(/^\d+ days$/u)).toBeVisible();
      await expect(page.getByText("10 min a day", { exact: true })).toBeVisible();

      await expect(
        page.getByText(
          "10 min a day doesn't reach every topic: the ones that come up least are left out.",
        ),
      ).toBeVisible();

      // What's on her exam, the moment she decides to trust the plan: every subject of the
      // notice and its topics, her foreign language inside Linguagens, one tap away.
      await page.getByRole("button", { name: "See topics" }).click();

      const structure = page.getByRole("dialog", { name: "What you'll study" });
      await structure.getByRole("button", { name: /^Matemática e suas Tecnologias/u }).click();

      await expect(
        structure.getByText("Conhecimentos de estatística e probabilidade", { exact: true }),
      ).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(structure).toBeHidden();

      // The phases show as bands as long as their days: nothing to open yet.
      const phases = page.getByRole("region", { exact: true, name: "Phases" });
      await expect(phases.getByRole("listitem")).toHaveCount(4);
      await expect(phases.getByRole("button")).toHaveCount(0);
      await expect(phases.getByRole("link")).toHaveCount(0);

      // An exam's reveal offers no other time: the time step just offered Find, and Adjust holds
      // the rest. Nothing on it was searched for the page.
      await expect(page.getByRole("button", { name: /^Use .+ a day$/u })).toHaveCount(0);

      await expect(
        page.getByRole("button", { name: "Move your date to cover everything" }),
      ).toHaveCount(0);

      await expect(page.getByRole("link", { name: "Start" })).toHaveAttribute("href", "/today");
    });
  });
});
