import { randomUUID } from "node:crypto";
import { type Locator } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import {
  goalFixture,
  planChangeFixture,
  planFixture,
  planItemFixture,
} from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { parsePlanChangePayload } from "../../../packages/core/src/plans/_utils/plan-change-payload";
import {
  parsePlanGraph,
  parsePlanSettings,
} from "../../../packages/core/src/plans/planner/plan-state";
import { expect, test } from "./fixtures";
import { tabTo } from "./keyboard-focus";
import { asPersona } from "./learn-personas";
import { REPLAN_TIMEOUT_MS } from "./plan-timeouts";
import { createProposalPlan } from "./proposal-plan";
import { openAs, readDayNames } from "./study-day";
import { routeTimeToCover } from "./time-to-cover-routes";

/** What the plan-edit model said of the learner's words, stored with the change. */
const PROPOSAL = "Twenty-five minutes a day keeps your plan on track for the exam.";

/**
 * What the card said of a proposal before the learner's OK: its own operation, but in the past
 * tense, so it read as done. It now says "Daily time: 25 min.", which waits for the translation
 * pass (an E2E build shows a message not extracted yet by its id), so the tests check the past
 * tense is gone; check the new sentence once it's extracted.
 */
const PAST_TENSE_CARD = "Daily time changed to 25 min.";
const DAYS_PER_WEEK = 7;

/** A goal date this close, which no daily time covers. */
const SOON_DAYS = 5;

const WEDNESDAY = 3;

/**
 * How many days ago last week's Wednesday was: 7 to 13. A plan that starts on a Monday has a full
 * first week, which funds a mock on its first Sunday at any daily time, so no change moves its next
 * mock. The goal itself stays new, so its free week of exam prep still runs.
 */
function daysSinceLastWeeksWednesday(): number {
  const today = toUTCMidnight(new Date());
  return DAYS_PER_WEEK + ((today.getUTCDay() - WEDNESDAY + DAYS_PER_WEEK) % DAYS_PER_WEEK);
}

/**
 * A card's text as a learner reads it: its diff keeps each day whole with no-break spaces
 * ("Oct 28"), which read as spaces.
 */
async function readText(locator: Locator): Promise<string> {
  const text = await locator.innerText();
  return text.replaceAll("\u00A0", " ");
}

function readChangeStatus(changeId: string) {
  return prisma.planChange
    .findUniqueOrThrow({ where: { id: changeId } })
    .then((change) => change.status);
}

/** A learner with one lesson due today, so Today shows the day and its plan change. */
async function createLessonDayPlan() {
  const user = await createE2EUser(getBaseURL());
  const suffix = randomUUID().slice(0, 6);

  const [goal, lesson] = await Promise.all([
    goalFixture({ timezone: "UTC", title: `Enem ${suffix}`, userId: user.id }),
    libraryLessonFixture({ title: `Food chains ${suffix}` }),
  ]);

  const [plan] = await Promise.all([
    planFixture({ goalId: goal.id }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  await planItemFixture({
    lessonId: lesson.id,
    planId: plan.id,
    position: 0,
    scheduledFor: toUTCMidnight(new Date()),
    titleSnapshot: lesson.title,
  });

  return { plan, user };
}

/** Calendar labels match the learner's UTC plan, including a year for dates beyond this year. */
function proposalDate(isoDate: string, month: "long" | "short" = "long") {
  const date = new Date(`${isoDate}T00:00:00Z`);

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month,
    timeZone: "UTC",
    ...(date.getUTCFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
}

/** Counts the graph's real remaining lessons, including the lessons an unwritten block represents. */
async function proposalAreaLessons(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({
    include: { items: true },
    where: { id: planId },
  });

  const areas = new Map(
    parsePlanGraph(plan.graph).skills.map((skill) => [skill.skillId, skill.area]),
  );

  return plan.items
    .filter((item) => item.kind === "lesson" && item.status === "todo")
    .reduce((counts, item) => {
      const area = areas.get(item.skillId ?? "") ?? "";
      counts.set(area, (counts.get(area) ?? 0) + (item.lessonId ? 1 : (item.lessons ?? 1)));
      return counts;
    }, new Map<string, number>());
}

async function firstProposalLesson({ area, planId }: { area: string; planId: string }) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });

  const skillIds = parsePlanGraph(plan.graph)
    .skills.filter((skill) => skill.area === area)
    .map((skill) => skill.skillId);

  return prisma.planItem.findFirst({
    orderBy: [{ scheduledFor: "asc" }, { position: "asc" }],
    where: {
      kind: "lesson",
      planId,
      scheduledFor: { not: null },
      skillId: { in: skillIds },
      status: "todo",
    },
  });
}

/**
 * Today's notice is the one place to answer a plan change, only when the learner has a say: any
 * proposal waiting for an OK, and missed days that put the date at risk.
 */
test.describe("Today's plan change", () => {
  // Ana applied a suggestion on Today and undid it: the card said her plan was back as it was, but
  // today's session was built again, other lessons and no mistakes practice. Undo gives back the
  // day she had: the same blocks, in the same order.
  test("gives back today's session as it was when the learner undoes a suggestion", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });

      const readBlocks = async () => {
        const session = await prisma.studySession.findFirstOrThrow({
          include: { blocks: { orderBy: { position: "asc" } } },
          orderBy: { localDate: "desc" },
          where: { goalId: user.goalId },
        });

        return session.blocks.map((block) => `${block.id}:${block.status}`);
      };

      await page.goto("/today");
      const day = page.getByRole("region", { name: "Today's session" }).getByRole("listitem");
      await expect(day.first()).toBeVisible();
      const names = await readDayNames(day);
      const blocks = await readBlocks();

      const change = await planChangeFixture({
        kind: "edited",
        payload: { operations: [{ kind: "setDailyMinutes", minutes: 90 }], source: "planEdit" },
        planId: plan.id,
        reason: PROPOSAL,
        status: "proposed",
      });

      await page.reload();
      const note = page.getByRole("region", { name: "Suggested change" });
      await expect(note.getByRole("button", { name: "Apply" })).toBeVisible();
      await expect(note).not.toContainText(PAST_TENSE_CARD);
      await expect(note).not.toContainText(PROPOSAL);

      // Nothing changes before the learner's OK.
      expect(await readChangeStatus(change.id)).toBe("proposed");

      await tabTo(page, note.getByRole("button", { name: "Apply" }));
      await page.keyboard.press("Enter");

      // The answer says what it did, where the buttons were, and focus stays on the note: today's
      // session wasn't started, so it follows the change.
      await expect(note.getByRole("status")).toHaveText(
        "It's in your plan, and today's session follows it.",
        { timeout: REPLAN_TIMEOUT_MS },
      );

      await expect(note).toBeFocused();
      await expect(page).toHaveURL(/\/today$/u);
      await expect.poll(() => readChangeStatus(change.id)).toBe("applied");
      await expect.poll(readBlocks).not.toStrictEqual(blocks);
      await note.getByRole("button", { name: "Undo" }).click();
      await expect.poll(readBlocks).toStrictEqual(blocks);
      await expect.poll(() => readDayNames(day)).toStrictEqual(names);

      // Undo gives the suggestion back too, waiting for her answer as before Apply: she read
      // "Undone" with no way back to it until she reloaded.
      await expect(note.getByRole("button", { name: "Apply" })).toBeVisible();
      await expect(note.getByRole("status")).toHaveCount(0);
      await expect(note).toBeFocused();
      await expect.poll(() => readChangeStatus(change.id)).toBe("proposed");
    });
  });

  test("answers each waiting proposal in turn, the buddy's and the exam notice's", async ({
    browser,
  }) => {
    const { plan, user } = await createProposalPlan({
      exam: true,
      specs: [{ area: "Stocks", lessons: 4, name: "Financial basics" }],
    });

    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: plan.goalId } });

    const noticeDay = new Date((goal.targetDate ?? new Date()).getTime() + 7 * 86_400_000)
      .toISOString()
      .slice(0, "YYYY-MM-DD".length);

    // The notice's date came first; the buddy's time came later and changes something else.
    const notice = await planChangeFixture({
      createdAt: new Date(Date.now() - 60_000),
      kind: "edited",
      payload: {
        operations: [{ estimated: false, kind: "setNoticeDate", targetDate: noticeDay }],
        source: "notice",
      },
      planId: plan.id,
      reason: "",
      status: "proposed",
    });

    const time = await planChangeFixture({
      kind: "edited",
      payload: { operations: [{ kind: "setDailyMinutes", minutes: 25 }], source: "planEdit" },
      planId: plan.id,
      reason: PROPOSAL,
      status: "proposed",
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    // The newest shows first, alone; the other waits without clutter.
    const note = page.getByRole("region", { name: "Suggested change" });
    await expect(note).not.toContainText(/The exam notice says/u);
    await expect(note).not.toContainText(PAST_TENSE_CARD);
    await expect(page.getByRole("button", { name: "Next suggestion" })).toHaveCount(0);

    await note.getByRole("button", { name: "Apply" }).click();

    // No session is built for today yet, so the plan follows it from now on.
    await expect(note.getByRole("status")).toHaveText("Your plan follows it from now on.", {
      timeout: REPLAN_TIMEOUT_MS,
    });

    await expect.poll(() => readChangeStatus(time.id)).toBe("applied");

    // Then the one still waiting, by keyboard: it takes the notice's place and focus.
    const next = note.getByRole("button", { name: "Next suggestion" });
    await tabTo(page, next);
    await page.keyboard.press("Enter");

    // The notice asks before its day moves the plan; Keep mine keeps the learner's date.
    const noticeNote = page.getByRole("region", { name: "Suggested change" });
    await expect(noticeNote).toContainText(/^The exam notice says /u);
    await expect(noticeNote).toBeFocused();
    await expect(noticeNote.getByRole("button", { name: "Apply" })).toBeVisible();

    await noticeNote.getByRole("button", { name: "Keep mine" }).click();
    await expect(noticeNote.getByRole("status")).toHaveText("Your plan stays as it was.");
    await expect.poll(() => readChangeStatus(notice.id)).toBe("declined");
    await expect(page.getByRole("button", { name: "Next suggestion" })).toHaveCount(0);

    const kept = await prisma.goal.findUniqueOrThrow({ where: { id: plan.goalId } });
    expect(kept.targetDate).toStrictEqual(goal.targetDate);
    await page.context().close();
  });

  test("names the lessons and topics a suggestion leaves out and the end it moves", async ({
    browser,
  }) => {
    const { plan, user } = await createProposalPlan({
      specs: [
        { area: "Osmosis", lessons: 100, name: "Osmosis" },
        {
          area: "Biology",
          lessons: 4,
          name: "Viruses",
          topics: ["12 Viruses"],
          written: ["Chromatin", "Golgi apparatus", "Lysosomes", "Peroxisomes"],
        },
      ],
    });

    const skill = await skillFixture({ name: "Cell membranes" });

    await planChangeFixture({
      kind: "edited",
      payload: {
        operations: [
          { areas: ["Biology"], kind: "skipAreas" },
          {
            kind: "addSkills",
            skills: [
              {
                area: "Osmosis",
                beforeSkillId: null,
                lessons: 2,
                name: skill.name,
                skillId: skill.id,
              },
            ],
          },
          { kind: "setDailyMinutes", minutes: 5 },
        ],
        source: "planEdit",
      },
      planId: plan.id,
      reason: "",
      status: "proposed",
    });

    const page = await openAs(browser, user);
    await page.goto("/today");
    const note = page.getByRole("region", { name: "Suggested change" });

    await expect(note).toContainText(
      "Adds about 2 lessons and leaves out 4: Chromatin, Golgi apparatus, Lysosomes and 1 more.",
    );

    await expect(note).toContainText("1 topic leaves: Viruses.");
    await expect(note).not.toContainText("12 Viruses");
    await expect(note).toContainText(/Ends around .+ instead of /u);
    await expect(note.getByRole("button", { name: "Apply" })).toBeVisible();
    await page.context().close();
  });

  test("counts every lesson a change leaves out when it names only some of them", async ({
    browser,
  }) => {
    const names = [
      "Situated identities",
      "Belonging",
      "Cultural exchange",
      "Digital genres",
      "Art and society",
    ];

    const { plan, user } = await createProposalPlan({
      specs: [
        { area: "Math", lessons: 3, name: "Percentages" },
        ...names.map((name, index) => ({ area: "Culture", lessons: index === 4 ? 4 : 10, name })),
      ],
    });

    await planChangeFixture({
      kind: "edited",
      payload: { operations: [{ areas: ["Culture"], kind: "skipAreas" }], source: "planEdit" },
      planId: plan.id,
      reason: "",
      status: "proposed",
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    await expect(page.getByRole("region", { name: "Suggested change" })).toContainText(
      "Leaves out 44 lessons, such as Situated identities, Belonging, and Cultural exchange.",
    );

    await page.context().close();
  });

  test("a focus explains the extra depth behind a subject's later finish before applying", async ({
    browser,
  }) => {
    // Short enough on time that Criminal law keeps only some of its lessons and ends before the
    // plan's last lesson day on any weekday, so the focus ends it later. Since challenges run on
    // top of their days, 45 minutes a day took it to that last day already: no focus could.
    const phases = [0, 1];
    const lessonsPerSkill = 6;

    const { plan, user } = await createProposalPlan({
      dailyMinutes: 30,
      exam: true,
      examDays: 21,
      lessonMinutes: 6,
      specs: ["Math", "Civil law", "Criminal law"].flatMap((area) =>
        phases.map((phase) => ({
          area,
          lessons: lessonsPerSkill,
          name: `${area} ${phase === 0 ? "basics" : "application"}`,
          phase,
          written: Array.from(
            { length: lessonsPerSkill },
            (_, index) => `${area} ${phase}.${index} ${randomUUID()}`,
          ),
        })),
      ),
      startDaysAgo: 0,
    });

    const change = await planChangeFixture({
      kind: "edited",
      payload: {
        operations: [{ areas: ["Criminal law"], kind: "focusAreas" }],
        source: "planEdit",
      },
      planId: plan.id,
      status: "proposed",
    });

    const before = await proposalAreaLessons(plan.id);
    const first = await firstProposalLesson({ area: "Criminal law", planId: plan.id });
    const beforeStart = first?.scheduledFor?.toISOString().slice(0, 10) ?? null;

    expect(before.get("Criminal law")).toBeGreaterThan(0);
    expect(before.get("Criminal law")).toBeLessThan(phases.length * lessonsPerSkill);
    expect(beforeStart).toMatch(/^\d{4}-\d{2}-\d{2}$/u);

    expect(
      parsePlanSettings(plan.settings).mockFunding.some((entry) => entry.contributions.length > 0),
    ).toBe(true);

    const page = await openAs(browser, user);
    await page.goto("/today");
    const note = page.getByRole("region", { name: "Suggested change" });
    await expect(note.getByRole("button", { exact: true, name: "Apply" })).toBeEnabled();
    const preview = await readText(note);
    await note.getByRole("button", { exact: true, name: "Apply" }).click();
    await expect.poll(() => readChangeStatus(change.id)).toBe("applied");
    const applied = await prisma.planChange.findUniqueOrThrow({ where: { id: change.id } });
    const effect = parsePlanChangePayload(applied.payload).effect;
    const end = effect?.areaEnds?.find((area) => area.area === "Criminal law");
    const start = effect?.areaStarts?.find((area) => area.area === "Criminal law");

    if (!end) {
      throw new Error("The real focus must move Criminal law's finish");
    }

    if (!start?.before || !start.after) {
      throw new Error("The real focus must name Criminal law's start before and after");
    }

    const after = await proposalAreaLessons(plan.id);
    const gained = (after.get("Criminal law") ?? 0) - (before.get("Criminal law") ?? 0);
    expect(gained).toBeGreaterThan(1);
    expect(end.lessonsGained).toBe(gained);
    expect(Date.parse(end.after)).toBeGreaterThan(Date.parse(end.before));
    expect(start.before).toBe(beforeStart);
    expect(start.after).toBe(start.before);
    expect(preview).not.toContain("You still start Criminal law");

    expect(preview).toContain(
      `Criminal law gets ${gained} more lessons, so you finish it around ${proposalDate(end.after)} instead of ${proposalDate(end.before)}.`,
    );

    expect(preview).toContain(`Criminal law until ${proposalDate(end.before, "short")}`);
    expect(preview).toContain(`Criminal law until ${proposalDate(end.after, "short")}`);
    await page.context().close();
  });

  test("a focus names the computed earlier start of its subject before applying", async ({
    browser,
  }) => {
    const { plan, user } = await createProposalPlan({
      dailyMinutes: 12,
      exam: true,
      examDays: 21,
      specs: [
        { area: "Ethics", lessons: 4, name: "Ethics" },
        { area: "Strategy", lessons: 120, name: "Strategy" },
        { area: "Criminal law", lessons: 120, name: "Criminal law" },
      ],
      startDaysAgo: 0,
    });

    const change = await planChangeFixture({
      kind: "edited",
      payload: {
        operations: [{ areas: ["Criminal law"], kind: "focusAreas" }],
        source: "planEdit",
      },
      planId: plan.id,
      status: "proposed",
    });

    const page = await openAs(browser, user);
    await page.goto("/today");
    const note = page.getByRole("region", { name: "Suggested change" });
    await expect(note.getByRole("button", { exact: true, name: "Apply" })).toBeEnabled();
    const preview = await readText(note);
    await note.getByRole("button", { exact: true, name: "Apply" }).click();
    await expect.poll(() => readChangeStatus(change.id)).toBe("applied");
    const applied = await prisma.planChange.findUniqueOrThrow({ where: { id: change.id } });
    const effect = parsePlanChangePayload(applied.payload).effect;
    const start = effect?.areaStarts?.find((area) => area.area === "Criminal law");

    if (!start?.before || !start.after) {
      throw new Error("The real focus must name Criminal law's start before and after");
    }

    expect(Date.parse(start.after)).toBeLessThan(Date.parse(start.before));

    expect(preview).toContain(
      `You start Criminal law on ${proposalDate(start.after)} instead of ${proposalDate(start.before)}.`,
    );

    await page.context().close();
  });

  test("a focus and reduction name lesson changes in a subject they did not name", async ({
    browser,
  }) => {
    const { plan, user } = await createProposalPlan({
      dailyMinutes: 19,
      exam: true,
      examDays: 21,
      specs: [
        { area: "Ethics", lessons: 4, name: "Ethics" },
        { area: "Strategy", lessons: 24, name: "Strategy" },
        { area: "Criminal law", lessons: 24, name: "Criminal law" },
      ].map((spec) => ({
        ...spec,
        written: Array.from(
          { length: spec.lessons },
          (_, index) => `${spec.area} ${index} ${randomUUID()}`,
        ),
      })),
      startDaysAgo: 0,
    });

    const change = await planChangeFixture({
      kind: "edited",
      payload: {
        operations: [
          { areas: ["Ethics"], kind: "focusAreas" },
          { areas: ["Strategy"], kind: "reduceAreas" },
        ],
        source: "planEdit",
      },
      planId: plan.id,
      status: "proposed",
    });

    const before = await proposalAreaLessons(plan.id);

    expect(before.get("Ethics")).toBe(4);
    expect(before.get("Strategy")).toBeGreaterThan(0);
    expect(before.get("Criminal law")).toBeGreaterThan(0);
    expect(before.get("Criminal law")).toBeLessThan(24);

    const ethicsFirst = await firstProposalLesson({ area: "Ethics", planId: plan.id });

    const ethicsLast = await prisma.planItem.findFirst({
      orderBy: { scheduledFor: "desc" },
      where: {
        kind: "lesson",
        planId: plan.id,
        scheduledFor: { not: null },
        skillId: ethicsFirst?.skillId,
        status: "todo",
      },
    });

    if (!ethicsFirst?.scheduledFor || !ethicsLast?.scheduledFor) {
      throw new Error("The four Ethics lessons must have real promised start and finish dates");
    }

    expect(
      parsePlanSettings(plan.settings).mockFunding.some((entry) => entry.contributions.length > 0),
    ).toBe(true);

    const page = await openAs(browser, user);
    await page.goto("/today");
    const note = page.getByRole("region", { name: "Suggested change" });
    await expect(note.getByRole("button", { exact: true, name: "Apply" })).toBeEnabled();
    const preview = await readText(note);

    await note.getByRole("button", { exact: true, name: "Apply" }).click();
    await expect.poll(() => readChangeStatus(change.id)).toBe("applied");
    const applied = await prisma.planChange.findUniqueOrThrow({ where: { id: change.id } });
    const effect = parsePlanChangePayload(applied.payload).effect;
    const area = effect?.areaLessons?.find((item) => item.area === "Criminal law");

    if (!area) {
      throw new Error("The real reduction must move the unnamed Criminal law lesson count");
    }

    // How many lessons each subject keeps depends on the weekday the plan starts on: the card's
    // numbers are the plan's own, read before and after the change.
    const after = await proposalAreaLessons(plan.id);
    expect(after.get("Ethics")).toBe(4);
    expect(after.get("Strategy")).toBe(8);
    expect(area.before).toBe(before.get("Criminal law"));
    expect(area.after).toBe(after.get("Criminal law"));
    expect(area.after - area.before).toBeGreaterThan(2);

    const ethicsLastAfter = await prisma.planItem.findFirstOrThrow({
      orderBy: { scheduledFor: "desc" },
      where: {
        kind: "lesson",
        planId: plan.id,
        scheduledFor: { not: null },
        skillId: ethicsFirst.skillId,
        status: "todo",
      },
    });

    // Ethics fits whole either way; the days the reduction frees can move its last lesson, and
    // the change names that move exactly when it happens.
    const ethicsEnd = {
      after: ethicsLastAfter.scheduledFor?.toISOString().slice(0, 10),
      before: ethicsLast.scheduledFor.toISOString().slice(0, 10),
    };

    expect(effect?.areaEnds?.find((item) => item.area === "Ethics")).toStrictEqual(
      ethicsEnd.after === ethicsEnd.before ? undefined : { area: "Ethics", ...ethicsEnd },
    );

    expect(effect?.areaStarts?.find((item) => item.area === "Ethics")).toStrictEqual({
      after: ethicsFirst.scheduledFor.toISOString().slice(0, 10),
      area: "Ethics",
      before: ethicsFirst.scheduledFor.toISOString().slice(0, 10),
    });

    await expect(firstProposalLesson({ area: "Ethics", planId: plan.id })).resolves.toMatchObject({
      scheduledFor: ethicsFirst.scheduledFor,
    });

    expect(preview).toContain(
      `Criminal law: ${area.after} lessons to go instead of ${area.before}.`,
    );

    expect(preview).toContain(`Criminal law: ${area.before} lessons to go`);
    expect(preview).toContain(`Criminal law: ${area.after} lessons to go`);
    await page.context().close();
  });

  test("says about how many lessons a topic adds while they aren't written", async ({
    browser,
  }) => {
    const { plan, user } = await createProposalPlan({
      specs: [
        {
          area: "Investing",
          lessons: 1,
          name: "Stock prices",
          written: ["How a stock price moves"],
        },
      ],
    });

    const skill = await skillFixture({ name: "Investing small amounts" });

    await planChangeFixture({
      kind: "edited",
      payload: {
        operations: [
          {
            kind: "addSkills",
            skills: [
              { area: null, beforeSkillId: null, lessons: 8, name: skill.name, skillId: skill.id },
            ],
          },
        ],
        source: "buddy",
      },
      planId: plan.id,
      reason: "",
      status: "proposed",
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    // Its diff leads with the lessons it adds, about how many while they aren't written.
    const diff = page
      .getByRole("region", { name: "Suggested change" })
      .locator("[data-slot=diff-lines]");

    await expect(diff.getByRole("listitem").first()).toHaveText(/Adds about 8 lessons$/u);

    await page.context().close();
  });

  test("says the day a change moves the next mock to", async ({ browser }) => {
    const { built, plan, today, user } = await createProposalPlan({
      dailyMinutes: 5,
      exam: true,
      specs: [{ area: "Culture", lessons: 300, name: "Cultural identity" }],
      startDaysAgo: daysSinceLastWeeksWednesday(),
    });

    const before = built.items.find(
      (item) => item.kind === "mock" && item.scheduledFor && item.scheduledFor >= today,
    );

    expect(before?.scheduledFor).toBeTruthy();

    await planChangeFixture({
      kind: "edited",
      payload: { operations: [{ kind: "setDailyMinutes", minutes: 240 }], source: "planEdit" },
      planId: plan.id,
      reason: "",
      status: "proposed",
    });

    const page = await openAs(browser, user);
    await page.goto("/today");
    const note = page.getByRole("region", { name: "Suggested change" });
    await expect(note).toContainText(/Your next mock moves to [A-Z][a-z]+, [A-Z][a-z]+ \d+/u);
    await expect(note.getByRole("button", { name: "Apply" })).toBeVisible();
    await page.context().close();
  });

  // After one missed day, Will's Today said "Your plan changed" with a dozen topic names and
  // "Leaves out 194 lessons, adds about 212", without saying whether anything had to be done.
  // Missed days that keep the goal's date in reach are the plan doing its job: Today asks nothing.
  test("asks nothing about missed days that move topics and lessons but keep the date in reach", async ({
    browser,
  }) => {
    const { plan, user } = await createLessonDayPlan();

    await planChangeFixture({
      kind: "missedDays",
      payload: {
        behind: null,
        days: 1,
        effect: {
          endDateAfter: null,
          endDateBefore: null,
          lessonsAdded: 212,
          lessonsRemoved: 194,
          topicsAdded: [{ area: "Natural sciences", topics: ["Ecology", "Evolution"] }],
          topicsLeftOut: [{ area: "Natural sciences", topics: ["Food chains", "Genetics"] }],
        },
        source: "system",
      },
      planId: plan.id,
      reason: "Lessons earlier days left come first; the rest of the plan moved forward.",
      status: "applied",
    });

    const page = await openAs(browser, user);
    await page.goto("/today");
    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();

    // Today's own view carries no change to answer, so no card waits to show.
    const response = await page.request.get("/api/learner/views/today");
    const body = await response.json();

    expect(body).toMatchObject({
      copy: { view: { today: { planChange: null } } },
      status: "ready",
    });

    await expect(page.getByRole("region", { name: /^(?:Plan|Suggested) change$/u })).toHaveCount(0);
    await expect(page.getByText(/no longer fits? by your date/u)).toHaveCount(0);
    await page.context().close();
  });

  // LEAD ruling (A)/(A′): Today's falling-behind card says only exact facts, and its "more time"
  // and "move date" choices are one link into the plan editor's time a day, where Find and Move
  // your date work out what covers everything when the learner asks.
  test("links days away to the editor's time a day, where moving the date covers it all", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      // Marcos's move came forward to five days away and he missed days: no time a day covers his
      // goal by then, while his 25 minutes cover it all by a later date.
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });
      const soon = new Date(toUTCMidnight(new Date()).getTime() + SOON_DAYS * MS_PER_DAY);

      await prisma.goal.update({ data: { targetDate: soon }, where: { id: user.goalId } });

      await planChangeFixture({
        kind: "missedDays",
        payload: {
          behind: {
            canFocus: false,
            coveredAfter: 0.1,
            coveredBefore: 0.12,
            currentMinutes: 25,
            measure: "goal",
          },
          days: 3,
          source: "system",
        },
        planId: plan.id,
        reason: "Lessons earlier days left come first; the rest of the plan moved forward.",
        status: "applied",
      });

      // Main's E2E runs without the API: Find finds no daily time covers it by his date, and a
      // date his own time covers it all by.
      await routeTimeToCover(page, {
        goalId: user.goalId,
        time: { fittingDate: "2028-09-28", targetDate: soon.toISOString().slice(0, 10) },
      });

      await page.goto("/today");
      const note = page.getByRole("region", { name: "Plan change" });

      await expect(
        note.getByRole("heading", {
          name: "At 25 min a day, your plan now covers 10% of your goal, down from 12%.",
        }),
      ).toBeVisible();

      // Nothing searched on Today: no date or time to switch to, and no number in a choice.
      await expect(note.getByText(/your plan covers everything by/u)).toHaveCount(0);
      await expect(note.getByRole("button", { name: /\d/u })).toHaveCount(0);
      await expect(note.getByRole("link", { name: /\d/u })).toHaveCount(0);
      await expect(note.getByRole("link", { name: "Study everything" })).toBeVisible();

      const adjust = note.getByRole("link", { name: "More time or a later date" });
      await expect(adjust).toHaveAttribute("href", /\/plan\?focus=time$/u);
      await adjust.click();

      // The editor opens at the time a day, the chips focused, with Move your date right below.
      await expect(page).toHaveURL(/\/plan\?focus=time$/u);
      const editor = page.getByRole("dialog", { name: "Adjust your plan" });
      const minutes = editor.getByRole("radiogroup", { name: "Time a day" });
      await expect(minutes.locator(":focus")).toHaveCount(1);

      // A tap finds the date and names it; the next one moves it.
      await editor.getByRole("button", { name: "Move your date to cover everything" }).click();
      await editor.getByRole("button", { name: "Move your date to September 28, 2028" }).click();

      await expect
        .poll(async () => {
          const moved = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
          return moved.targetDate?.toISOString().slice(0, 10);
        })
        .toBe("2028-09-28");
    });
  });

  // Rafaela's card said "about 54%" while her Plan said "about 55%": the plan moved after the
  // morning's settle. Today now says no searched time at all (LEAD ruling A), so the two never
  // disagree, even for a change saved while the card still kept one.
  test("says no searched time on Today, even for a change saved with one", async ({ browser }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });

      await planChangeFixture({
        kind: "missedDays",
        payload: {
          behind: {
            canFocus: false,
            coveredAfter: 0.8,
            coveredBefore: 0.9,
            currentMinutes: 25,
            dailyMinutes: 300,
            fittingDate: null,
            fullDepth: true,
            maximumShare: null,
            measure: "goal",
          },
          days: 3,
          source: "system",
        },
        planId: plan.id,
        reason: "Lessons earlier days left come first; the rest of the plan moved forward.",
        status: "applied",
      });

      await page.goto("/today");
      const note = page.getByRole("region", { name: "Plan change" });

      await expect(note.getByRole("link", { name: "More time or a later date" })).toBeVisible();
      await expect(note.getByRole("button", { name: /^Study .+ a day/u })).toHaveCount(0);
      await expect(note.getByText(/5\shr|everything in depth/u)).toHaveCount(0);
    });
  });

  // An IELTS learner's card lists the tested-out lessons separately from the topics it moves.
});
