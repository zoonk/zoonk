import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
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
const ALL_ANSWERED = [
  "purpose",
  "role",
  "reason",
  "target",
  "targetDate",
  "followUps",
  "level",
  "schedule",
  "age",
  "memory",
  "buddy",
  "placement",
] as const;

const STATUS = /(?:On track|Needs adjusting|One day (?:ahead|behind)|\d+ days (?:ahead|behind))/u;

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

      // What's on the exam: the notice's subjects in its words, each opening its page.
      const syllabus = page.getByRole("region", { name: "What's on the exam" });
      await expect(syllabus.getByText(/^5 subjects · \d+ topics$/u)).toBeVisible();

      await expect(syllabus.getByRole("link")).toHaveText([
        /^Linguagens, Códigos e suas Tecnologias/u,
        /^Ciências Humanas e suas Tecnologias/u,
        /^Ciências da Natureza e suas Tecnologias/u,
        /^Matemática e suas Tecnologias/u,
        /^Redação/u,
      ]);

      // What the old tabs listed lives elsewhere now: mocks and the mistakes notebook are practiced
      // from Today.
      await expect(page.getByRole("link", { name: /^Mistakes notebook/u })).toHaveCount(0);
      await expect(page.getByRole("link", { name: /^Take a mock exam/u })).toHaveCount(0);
      await expect(page.getByRole("region", { name: "This week" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: /^Weekly summary/u })).toHaveCount(0);
      await expect(page.getByRole("textbox", { name: /Search/u })).toHaveCount(0);

      await expectAccessibleScreen(page, "the Journey");

      // The details behind the number, at a glance: the estimate after her mock, the four parts
      // as rings and the one or two things still to do, then back to where she was.
      await hero.click();
      const sheet = page.getByRole("dialog", { name: "Your preparation" });
      const estimate = sheet.locator('[data-slot="estimated-score"]');

      await expect(estimate).toContainText("Estimated score");
      await expect(estimate.getByText(/^\d+% to \d+%$/u)).toBeVisible();
      await expect(estimate.getByText("Based on your last mock exam")).toBeVisible();

      await expect(
        sheet.getByRole("region", { name: "How it's measured" }).getByRole("listitem"),
      ).toHaveText([
        /^\d+%Coverage: \d+%\d+ of \d+ skills$/u,
        /^\d+%Mastery: \d+%\d+ of \d+ right$/u,
        /^\d+%Long-term memory: \d+%Of what you studied$/u,
        /^\d+%Mock exams: \d+%1 mock exam taken$/u,
      ]);

      // Only what's left, never a checklist: her mock exam is done, so it isn't there.
      await expect(
        sheet.getByRole("region", { name: "Still to do" }).getByRole("listitem"),
      ).toHaveText([
        /^Get the topics that weigh most to Solid\s*\d+ skills? to go(?: · about .+ in your plan)?$/u,
        /^Keep what you studied fresh\s*\d+ skills? fading, back in your reviews$/u,
      ]);

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
      // notice's words alone, with no second index beside them; the ones past exams asked most say
      // so.
      await syllabus.getByRole("link", { name: /^Matemática e suas Tecnologias/u }).click();
      await expect(page).toHaveURL(/\/journey\/matematica-e-suas-tecnologias$/u);

      await expect(
        page.getByRole("heading", { level: 1, name: "Matemática e suas Tecnologias" }),
      ).toBeVisible();

      await expect(
        page.getByRole("list", { name: "Topics in the notice" }).getByRole("listitem"),
      ).toHaveText([
        "Conhecimentos numéricosAppears a lot",
        "Conhecimentos geométricos",
        "Conhecimentos de estatística e probabilidadeAppears a lot",
        "Conhecimentos algébricos",
        "Conhecimentos algébricos/geométricos",
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
      // The exam moved two months away while Ana kept 10 minutes a day.
      await prisma.goal.update({
        data: {
          dailyMinutes: 10,
          targetDate: new Date(toUTCMidnight(new Date()).getTime() + 60 * MS_PER_DAY),
        },
        where: { id: user.goalId },
      });

      await openJourney(page);

      // Ten minutes don't reach every topic: it says so, and the one time plans recommend, the
      // number the time step said, not a second "every topic" time.
      await expect(
        page.getByText(
          "10 min a day doesn't reach every topic: the ones that come up least are left out.",
        ),
      ).toBeVisible();

      await expect(
        page.getByText(
          /^To study everything in depth: .+ a day\.$|^At .+ a day, more of it in depth\.$/u,
        ),
      ).toBeVisible();

      await expect(page.getByText(/^To study every topic:/u)).toHaveCount(0);

      // The buddy's "Choose where to focus" opens the Journey with the sheet open; Esc closes it.
      await page.goto("/journey?focus=choose");
      await expect(page.getByRole("dialog", { name: "Where to focus" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Where to focus" })).toBeHidden();

      // Instead of more time, she picks where the depth goes.
      await page.getByRole("button", { name: "Choose where to focus" }).click();
      const focus = page.getByRole("dialog", { name: "Where to focus" });
      const subject = focus.getByRole("checkbox", { checked: false }).first();
      const picked = (await subject.getAttribute("aria-label")) ?? "";

      await subject.click();
      await focus.getByRole("button", { name: "Focus on these" }).click();

      // The sheet says what the focus did, with an undo, before it closes.
      await expect(focus.getByRole("status")).toContainText("More time for");
      await expect(focus.getByRole("status")).toContainText(picked);
      await expect(focus.getByRole("button", { name: "Undo" })).toBeVisible();
      await focus.getByRole("button", { name: "Done" }).click();
      await expect(focus).toBeHidden();

      await expect.poll(() => loadFocusAreas(user.goalId)).toContain(picked);

      await page.getByRole("button", { name: "Adjust plan" }).click();
      const editor = page.getByRole("dialog", { name: "Adjust your plan" });
      const minutes = editor.getByLabel("Time a day");

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

      const morePractice = editor.getByRole("button", { name: "More practice" });
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

  test("a focus on part of a subject says which part, and choosing subjects again keeps it", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      // The exam is two months away at 10 minutes a day: the plan doesn't fit, so she can focus.
      await prisma.goal.update({
        data: {
          dailyMinutes: 10,
          targetDate: new Date(toUTCMidnight(new Date()).getTime() + 60 * MS_PER_DAY),
        },
        where: { id: user.goalId },
      });

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

      // Adding another subject keeps the part she named.
      const other = focus.getByRole("checkbox", { checked: false }).first();
      await other.click();
      await focus.getByRole("button", { name: "Focus on these" }).click();
      await expect(focus.getByRole("status")).toContainText("More time for");

      await expect
        .poll(async () => {
          const saved = await loadPlanSettings(user.goalId);
          return isJsonObject(saved) ? saved.focusParts : null;
        })
        .toStrictEqual([part]);
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

  test("shares the plan's link, which brings its owner back to the Journey", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
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

      // Placement settled her basics, so a run-on list of skills never names a phase or a chapter.
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
      // notice and its topics, one tap away.
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
          /^Done\. Your plan now covers your whole goal\.$|^.+ a day studies every topic of the exam, the ones that come up most in more depth\.$/u,
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
