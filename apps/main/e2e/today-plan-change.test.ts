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
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import {
  getWeeklyMockMinutes,
  listMockClocks,
} from "../../../packages/core/src/exams/mocks/mock-plan";
import { parsePlanChangePayload } from "../../../packages/core/src/plans/_utils/plan-change-payload";
import { buildPlan } from "../../../packages/core/src/plans/planner/build-plan";
import {
  type PlanGraph,
  parsePlanGraph,
  parsePlanSettings,
} from "../../../packages/core/src/plans/planner/plan-state";
import { expect, test } from "./fixtures";
import { tabTo } from "./keyboard-focus";
import { asPersona } from "./learn-personas";
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
const STUDY_MINUTES = 30;
const LESSONS = 3;

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

/**
 * A learner whose plan the planner owns (a skill graph and settings), with one chapter of three
 * lessons, so a test-out's skip and its undo re-plan around them.
 */
async function createChapterPlan() {
  const user = await createE2EUser(getBaseURL());
  const suffix = randomUUID().slice(0, 6);
  const indexes = Array.from({ length: LESSONS }, (_, index) => index);

  const [goal, chapter, skills, lessons] = await Promise.all([
    goalFixture({ timezone: "UTC", title: `Circuits ${suffix}`, userId: user.id }),
    libraryChapterFixture({ title: `Electric circuits ${suffix}` }),
    Promise.all(indexes.map((index) => skillFixture({ name: `Circuit skill ${index} ${suffix}` }))),
    Promise.all(
      indexes.map((index) => libraryLessonFixture({ title: `Circuit lesson ${index} ${suffix}` })),
    ),
  ]);

  const [plan] = await Promise.all([
    planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Circuits" }],
        skills: skills.map((skill) => ({
          area: null,
          lessons: 1,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        })),
      },
      settings: {
        startDate: toUTCMidnight(new Date()).toISOString().slice(0, "YYYY-MM-DD".length),
        weekdayMinutes: Array.from({ length: DAYS_PER_WEEK }, () => STUDY_MINUTES),
      },
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    prisma.lessonSkill.createMany({
      data: lessons.map((lesson, index) => ({
        lessonId: lesson.id,
        skillId: skills[index]?.id ?? "",
      })),
    }),
  ]);

  const items = await Promise.all(
    lessons.map((lesson, position) =>
      planItemFixture({
        chapterId: chapter.id,
        lessonId: lesson.id,
        planId: plan.id,
        position,
        titleSnapshot: lesson.title,
      }),
    ),
  );

  return { chapter, goal, items, plan, user };
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

/**
 * Today's notice is the one place to answer a plan change: any proposal waiting for an OK, and the
 * automatic changes of the last day, with their undo while the plan is still as they left it.
 */
/** An area's topics as a change names them: "Ethics topic 1", "Ethics topic 2"… */
function areaTopics(area: string, count: number) {
  return {
    area,
    topics: Array.from({ length: count }, (_, index) => `${area} topic ${index + 1}`),
  };
}

/** Real Library content and a saved planner schedule, so proposed changes can be dry-run. */
async function createProposalPlan({
  dailyMinutes = 30,
  exam = false,
  examDays = 190,
  lessonMinutes = 3,
  specs,
  startDate,
  startDaysAgo = 10,
}: {
  dailyMinutes?: number;
  exam?: boolean;
  examDays?: number;
  lessonMinutes?: number;
  specs: {
    area: string;
    lessons: number;
    name: string;
    phase?: number;
    topics?: string[];
    written?: string[];
  }[];
  startDate?: Date;
  startDaysAgo?: number;
}) {
  const user = await createE2EUser(getBaseURL());
  const today = toUTCMidnight(new Date());
  const start = startDate ?? (exam ? new Date(today.getTime() - startDaysAgo * MS_PER_DAY) : today);

  const goal = await goalFixture({
    ...(startDate && { createdAt: startDate }),
    dailyMinutes,
    kind: exam ? "exam" : "learn",
    targetDate: exam ? new Date(today.getTime() + examDays * MS_PER_DAY) : null,
    timezone: "UTC",
    userId: user.id,
  });

  const skills = await Promise.all(specs.map((spec) => skillFixture({ name: spec.name })));

  const lessons = await Promise.all(
    specs.flatMap((spec, skillIndex) =>
      (spec.written ?? []).map(async (title) => {
        const lesson = await libraryLessonFixture({ estimatedMinutes: lessonMinutes, title });
        const skillId = skills[skillIndex]?.id ?? "";
        await prisma.lessonSkill.create({ data: { lessonId: lesson.id, skillId } });

        return {
          chapterId: null,
          lessonId: lesson.id,
          minutes: lessonMinutes,
          skillIds: [skillId],
          title,
        };
      }),
    ),
  );

  const graph: PlanGraph = {
    phases: [
      { milestone: null, name: "First interviews" },
      { milestone: null, name: "Practice" },
    ],
    skills: specs.map((spec, index) => ({
      area: spec.area,
      lessons: spec.lessons,
      name: spec.name,
      phase: spec.phase ?? 0,
      skillId: skills[index]?.id ?? "",
      topics: spec.topics,
      weight: null,
    })),
  };

  // Keep the fixture's built pace, as a real plan does, rather than sampling concurrent learners.
  const pace = { factor: 1, source: "typical" as const };
  const settings = parsePlanSettings({ pace, startDate: start.toISOString().slice(0, 10) });

  const built = buildPlan({
    fullMockMinutes: getWeeklyMockMinutes({ fullLength: true, structure: null }),
    goal,
    graph,
    items: [],
    lessons,
    mockClocks: listMockClocks(null),
    mockMinutes: getWeeklyMockMinutes({ fullLength: false, structure: null }),
    mode: "forced",
    paceFactor: pace.factor,
    prerequisites: new Map(),
    readiness: new Map(),
    settings,
    today: start,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph,
    phases: built.phases,
    settings: { ...settings, mockFunding: built.mockFunding },
  });

  await Promise.all([
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    prisma.planItem.createMany({
      data: built.items.map((item, position) => ({
        chapterId: item.chapterId,
        completedAt: item.completedAt,
        kind: item.kind,
        lessonId: item.lessonId,
        lessons: item.lessons,
        phase: item.phase,
        planId: plan.id,
        position,
        scheduledFor: item.scheduledFor,
        skillId: item.skillId,
        status: item.status,
        titleSnapshot: item.titleSnapshot,
      })),
    }),
  ]);

  return { built, plan, today, user };
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

test.describe("Today's plan change", () => {
  test("applies a proposal from the plan's assistant right on Today, by keyboard", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });

      const change = await planChangeFixture({
        kind: "edited",
        payload: { operations: [{ kind: "setDailyMinutes", minutes: 25 }], source: "planEdit" },
        planId: plan.id,
        reason: PROPOSAL,
        status: "proposed",
      });

      await page.goto("/today");

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
      );

      await expect(note).toBeFocused();
      await expect(page).toHaveURL(/\/today$/u);

      await expect.poll(() => readChangeStatus(change.id)).toBe("applied");

      await expect
        .poll(async () => {
          const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
          return goal.dailyMinutes;
        })
        .toBe(25);
    });
  });

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
      await note.getByRole("button", { name: "Apply" }).click();

      await expect(note.getByRole("status")).toHaveText(
        "It's in your plan, and today's session follows it.",
      );

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

  // Ana applied a suggestion, and Today showed it the next time she opened it, already applied,
  // with "Got it" and Undo. Undo gives the suggestion back there too: Apply again, not a card
  // still offering what Undo just took away.
  test("gives a suggestion back on Undo when Today opens on it already applied", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });

      // The persona's own waiting proposal is answered already, so only this one is shown.
      await prisma.planChange.updateMany({
        data: { status: "declined" },
        where: { planId: plan.id, status: "proposed" },
      });

      const change = await planChangeFixture({
        kind: "edited",
        payload: {
          operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [6] }],
          source: "memory",
        },
        planId: plan.id,
        reason: "You have a prep course on Saturday mornings. Rest on Saturdays?",
        status: "proposed",
      });

      await page.goto("/today");
      const suggestion = page.getByRole("region", { name: "Suggested change" });
      await suggestion.getByRole("button", { name: "Apply" }).click();
      await expect.poll(() => readChangeStatus(change.id)).toBe("applied");

      await page.reload();
      const applied = page.getByRole("region", { name: "Plan change" });
      await expect(applied.getByRole("button", { name: "Got it" })).toBeVisible();
      await applied.getByRole("button", { name: "Undo" }).click();
      await expect.poll(() => readChangeStatus(change.id)).toBe("proposed");

      const back = page.getByRole("region", { name: "Suggested change" });
      await expect(back.getByRole("button", { name: "Apply" })).toBeVisible();
      await expect(back.getByRole("button", { name: "Not now" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Got it" })).toHaveCount(0);
    });
  });

  test("answers each waiting proposal in turn, the buddy's and the exam notice's", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const [plan, goal] = await Promise.all([
        prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } }),
        prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } }),
      ]);

      const noticeDay = new Date((goal.targetDate ?? new Date()).getTime() + 7 * 86_400_000)
        .toISOString()
        .slice(0, "YYYY-MM-DD".length);

      // The persona's own waiting proposal is answered already, so only these two wait.
      await prisma.planChange.updateMany({
        data: { status: "declined" },
        where: { planId: plan.id, status: "proposed" },
      });

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

      await page.goto("/today");

      // The newest shows first, alone; the other waits without clutter.
      const note = page.getByRole("region", { name: "Suggested change" });
      await expect(note).not.toContainText(/The exam notice says/u);
      await expect(note).not.toContainText(PAST_TENSE_CARD);
      await expect(page.getByRole("button", { name: "Next suggestion" })).toHaveCount(0);

      await note.getByRole("button", { name: "Apply" }).click();
      await expect(note.getByRole("status")).toContainText("It's in your plan");
      await expect.poll(() => readChangeStatus(time.id)).toBe("applied");

      // Then the one still waiting, by keyboard: it takes the notice's place and focus.
      const next = note.getByRole("button", { name: "Next suggestion" });
      await tabTo(page, next);
      await page.keyboard.press("Enter");

      const noticeNote = page.getByRole("region", { name: "Suggested change" });
      await expect(noticeNote).toContainText(/^The exam notice says /u);
      await expect(noticeNote).toBeFocused();

      await noticeNote.getByRole("button", { name: "Keep mine" }).click();
      await expect(noticeNote.getByRole("status")).toHaveText("Your plan stays as it was.");
      await expect.poll(() => readChangeStatus(notice.id)).toBe("declined");
      await expect(page.getByRole("button", { name: "Next suggestion" })).toHaveCount(0);
    });
  });

  test("asks before the exam notice's day moves the plan, and Keep mine keeps the learner's date", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const [plan, goal] = await Promise.all([
        prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } }),
        prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } }),
      ]);

      const noticeDay = new Date((goal.targetDate ?? new Date()).getTime() + 7 * 86_400_000)
        .toISOString()
        .slice(0, "YYYY-MM-DD".length);

      const change = await planChangeFixture({
        kind: "edited",
        payload: {
          operations: [{ estimated: false, kind: "setNoticeDate", targetDate: noticeDay }],
          source: "notice",
        },
        planId: plan.id,
        reason: "",
        status: "proposed",
      });

      await page.goto("/today");

      const note = page.getByRole("region", { name: "Suggested change" });
      await expect(note).toContainText(/^The exam notice says /u);
      await expect(note.getByRole("button", { name: "Apply" })).toBeVisible();

      await note.getByRole("button", { name: "Keep mine" }).click();
      await expect(note.getByRole("status")).toHaveText("Your plan stays as it was.");

      await expect.poll(() => readChangeStatus(change.id)).toBe("declined");

      const kept = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
      expect(kept.targetDate).toStrictEqual(goal.targetDate);
    });
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
    // Enough of each subject and time that the focus moves Criminal law's finish on any weekday:
    // with fewer, its extra lessons fit its old last day on most of them.
    const phases = [0, 1];
    const lessonsPerSkill = 14;

    const { plan, user } = await createProposalPlan({
      dailyMinutes: 45,
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

  test("says which topics no longer fit when the plan changes as the learner studies", async ({
    browser,
  }) => {
    const { plan, user } = await createLessonDayPlan();

    // Lucas's plan after his first lesson: planned again, one topic no longer fits by his date.
    await planChangeFixture({
      kind: "coverageChanged",
      payload: {
        effect: {
          endDateAfter: null,
          endDateBefore: null,
          lessonsAdded: 0,
          lessonsRemoved: 4,
          topicsLeftOut: [{ area: "Natural sciences", topics: ["Origin and evolution of life"] }],
        },
        source: "system",
      },
      planId: plan.id,
      reason: "Planned again, the plan teaches other topics by its date.",
      status: "applied",
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    const note = page.getByRole("region", { name: "Plan change" });

    await expect(note).toContainText("Origin and evolution of life no longer fits by your date.");
    await expect(note.getByRole("button", { name: "Got it" })).toBeVisible();
    await page.context().close();
  });

  // Significant automatic re-estimates explain the net count once, with the same reason.
  // A one-lesson change stays quiet; the already applied notice has no Undo.
  test("says once why more lessons fit by the date after a session, with no Undo", async ({
    browser,
  }) => {
    const { plan, user } = await createLessonDayPlan();
    const effect = { endDateAfter: null, endDateBefore: null, lessonsRemoved: 0 };

    await planChangeFixture({
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      kind: "estimateUpdated",
      payload: { effect: { ...effect, lessonsAdded: 1 }, source: "system" },
      planId: plan.id,
      status: "applied",
    });

    const page = await openAs(browser, user);
    await page.goto("/today");
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Plan change" })).toHaveCount(0);

    const change = await planChangeFixture({
      kind: "estimateUpdated",
      payload: { effect: { ...effect, lessonsAdded: 4 }, source: "system" },
      planId: plan.id,
      status: "applied",
    });

    await page.reload();

    const note = page.getByRole("region", { name: "Plan change" });

    await expect(note.locator(".lucide-refresh-cw").filter({ visible: true })).toBeVisible();

    // Without a date, the plan keeps every lesson: the goal has more of them, it doesn't "add" any.
    const lessonsLine = note.locator("[data-slot=diff-lines]").getByRole("listitem").first();
    await expect(lessonsLine).toHaveText(/^\+\s*4 more lessons$/u);
    await expect(note.getByRole("link", { name: "Adjust plan" })).toHaveCount(0);
    await expect(note.getByRole("button", { name: "Undo" })).toHaveCount(0);

    await note.getByRole("button", { name: "Got it" }).click();
    await expect(note).toContainText("Noted.");

    await expect
      .poll(async () => {
        const saved = await prisma.planChange.findUniqueOrThrow({ where: { id: change.id } });
        return parsePlanChangePayload(saved.payload).seenAt;
      })
      .not.toBeNull();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Plan change" })).toHaveCount(0);
    await page.context().close();
  });

  test("names the lessons that no longer fit when the plan gives lessons more time", async ({
    browser,
  }) => {
    // Lessons only stop fitting by a date the plan has ahead.
    const { plan, user } = await createProposalPlan({
      exam: true,
      specs: [
        {
          area: "Stocks",
          lessons: 2,
          name: "Financial basics",
          written: ["Compound interest", "Diversification"],
        },
      ],
    });

    await planChangeFixture({
      kind: "estimateUpdated",
      payload: {
        effect: {
          endDateAfter: null,
          endDateBefore: null,
          lessonsAdded: 0,
          lessonsLeftOut: ["Compound interest", "Diversification"],
          lessonsRemoved: 2,
        },
        source: "system",
      },
      planId: plan.id,
      status: "applied",
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    const note = page.getByRole("region", { name: "Plan change" });

    await expect(note).toContainText(
      "Leaves out 2 lessons: Compound interest and Diversification.",
    );

    await expect(note.getByRole("button", { name: "Got it" })).toBeVisible();
    await expect(note.getByRole("button", { name: "Undo" })).toHaveCount(0);
    await note.getByRole("link", { name: "Adjust plan" }).click();
    await expect(page).toHaveURL(/\/plan\?focus=adjust$/u);
    const editor = page.getByRole("dialog", { name: "Adjust your plan" });
    await expect(editor).toBeVisible();
    await editor.getByRole("button", { exact: true, name: "Close" }).click();
    await expect(editor).not.toBeVisible();
    await page.context().close();
  });

  for (const fewer of [false, true]) {
    test(`shows an automatic re-estimate once when ${fewer ? "fewer" : "more"} lessons fit`, async ({
      browser,
    }) => {
      const { plan, user } = await createProposalPlan({
        exam: true,
        specs: [
          {
            area: "Stocks",
            lessons: 2,
            name: "Financial basics",
            written: ["Compound interest", "Diversification"],
          },
        ],
      });

      const change = await planChangeFixture({
        kind: "estimateUpdated",
        payload: {
          effect: {
            endDateAfter: null,
            endDateBefore: null,
            lessonsAdded: fewer ? 0 : 4,
            lessonsLeftOut: fewer ? ["Compound interest", "Diversification"] : [],
            lessonsRemoved: fewer ? 2 : 0,
          },
          source: "system",
        },
        planId: plan.id,
        status: "applied",
      });

      const page = await openAs(browser, user);
      await page.goto("/today");
      const note = page.getByRole("region", { name: "Plan change" });
      await expect(note).toContainText(fewer ? "Leaves out 2 lessons" : "Adds 4 lessons");
      // The news and reason are separate sentences, or two compiled message IDs until extraction.
      // A generic "Your plan changed" has neither structure and must not pass for an explanation.
      const explanation = note
        .getByRole("paragraph")
        .filter({ hasText: /\.\s+\S|^[\w+/=-]{6}\s+[\w+/=-]{6}$/u });

      await expect(explanation).toBeVisible();
      await expect(note.getByRole("button", { name: "Undo" })).toHaveCount(0);

      if (fewer) {
        // Plan has already been visited: the notice must still open its adjustment view.
        await note.getByRole("link", { name: "Adjust plan" }).click();
        await expect(page.getByRole("dialog", { name: "Adjust your plan" })).toBeVisible();

        await page
          .getByRole("dialog", { name: "Adjust your plan" })
          .getByRole("button", { exact: true, name: "Close" })
          .click();

        await page
          .getByRole("link", { exact: true, name: "Today" })
          .filter({ visible: true })
          .click();

        await expect(note.getByRole("button", { name: "Got it" })).toBeVisible();
        await note.getByRole("link", { name: "Adjust plan" }).click();
        await expect(page.getByRole("dialog", { name: "Adjust your plan" })).toBeVisible();

        await page
          .getByRole("dialog", { name: "Adjust your plan" })
          .getByRole("button", { exact: true, name: "Close" })
          .click();

        await page
          .getByRole("link", { exact: true, name: "Today" })
          .filter({ visible: true })
          .click();
      } else {
        await expect(note.getByRole("link", { name: "Adjust plan" })).toHaveCount(0);
      }

      await note.getByRole("button", { name: "Got it" }).click();
      await expect(note).toContainText("Noted.");

      await expect
        .poll(async () => {
          const saved = await prisma.planChange.findUniqueOrThrow({ where: { id: change.id } });
          return parsePlanChangePayload(saved.payload).seenAt;
        })
        .not.toBeNull();

      await page.reload();
      await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Plan change" })).toHaveCount(0);
      await page.context().close();
    });
  }

  test("uses by-date counts only for future plans that finish by that date", async ({
    browser,
  }) => {
    const readSentence = async (scenario: "undated" | "future" | "past" | "afterExam") => {
      const { plan, today, user } = await createProposalPlan({
        exam: scenario !== "undated",
        specs: [
          {
            area: "Stocks",
            lessons: 2,
            name: "Financial basics",
            written: ["Compound interest", "Diversification"],
          },
        ],
        startDaysAgo: 0,
      });

      const past = new Date(today.getTime() - MS_PER_DAY);
      const afterExam = new Date(today.getTime() + 200 * MS_PER_DAY).toISOString().slice(0, 10);

      if (scenario === "past") {
        await prisma.goal.update({ data: { targetDate: past }, where: { id: plan.goalId } });

        await prisma.plan.update({
          data: { settings: { ...parsePlanSettings(plan.settings), fullCourse: true } },
          where: { id: plan.id },
        });

        await prisma.examResult.create({
          data: { examDate: past, examName: "Stocks exam", goalId: plan.goalId, userId: user.id },
        });
      }

      await planChangeFixture({
        kind: "estimateUpdated",
        payload: {
          effect: {
            endDateAfter: scenario === "afterExam" ? afterExam : null,
            endDateBefore: null,
            lessonsAdded: 4,
            lessonsRemoved: 0,
          },
          source: "system",
        },
        planId: plan.id,
        status: "applied",
      });

      const page = await openAs(browser, user);
      await page.goto("/today");
      const note = page.getByRole("region", { name: "Plan change" });

      // The diff follows the sentence's rule: only a date ahead that the plan finishes by "adds".
      await expect(note.locator("[data-slot=diff-lines]").getByRole("listitem").first()).toHaveText(
        scenario === "future" ? /^\+\s*Adds 4 lessons$/u : /^\+\s*4 more lessons$/u,
      );

      const explanation = note.getByRole("paragraph").first();
      await expect(explanation).toBeVisible();
      const sentence = await explanation.innerText();
      await page.context().close();
      return sentence;
    };

    const undated = await readSentence("undated");
    const future = await readSentence("future");
    const past = await readSentence("past");
    const afterExam = await readSentence("afterExam");

    // These comparisons also work before extraction, when the sentences render their message IDs.
    expect(future).not.toBe(undated);
    expect(past).toBe(undated);
    expect(afterExam).toBe(undated);
  });

  test("offers Adjust plan for fewer lessons only while a date is ahead", async ({ browser }) => {
    // Without a date ahead the plan keeps every lesson, so fewer of them leaves nothing to win back.
    const countAdjustLinks = async (scenario: "undated" | "past") => {
      const { plan, today, user } = await createProposalPlan({
        exam: scenario === "past",
        specs: [
          {
            area: "Stocks",
            lessons: 2,
            name: "Financial basics",
            written: ["Compound interest", "Diversification"],
          },
        ],
        startDaysAgo: 0,
      });

      if (scenario === "past") {
        const past = new Date(today.getTime() - MS_PER_DAY);
        await prisma.goal.update({ data: { targetDate: past }, where: { id: plan.goalId } });

        await prisma.plan.update({
          data: { settings: { ...parsePlanSettings(plan.settings), fullCourse: true } },
          where: { id: plan.id },
        });

        await prisma.examResult.create({
          data: { examDate: past, examName: "Stocks exam", goalId: plan.goalId, userId: user.id },
        });
      }

      await planChangeFixture({
        kind: "estimateUpdated",
        payload: {
          effect: { endDateAfter: null, endDateBefore: null, lessonsAdded: 0, lessonsRemoved: 2 },
          source: "system",
        },
        planId: plan.id,
        status: "applied",
      });

      const page = await openAs(browser, user);
      await page.goto("/today");
      const note = page.getByRole("region", { name: "Plan change" });
      await expect(note.getByRole("button", { name: "Got it" })).toBeVisible();
      const links = await note.getByRole("link", { name: "Adjust plan" }).count();
      await page.context().close();
      return links;
    };

    expect(await countAdjustLinks("undated")).toBe(0);
    expect(await countAdjustLinks("past")).toBe(0);
  });

  test("names the subjects, not every topic, when a mock brings many known topics back", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const suffix = randomUUID().slice(0, 6);

    const [goal, lesson] = await Promise.all([
      goalFixture({ timezone: "UTC", title: `OAB ${suffix}`, userId: user.id }),
      libraryLessonFixture({ title: `Legal fees ${suffix}` }),
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

    // Sofia's first full mock: misses on topics placement took as known, in six subjects.
    await planChangeFixture({
      kind: "relearn",
      payload: {
        effect: {
          endDateAfter: null,
          endDateBefore: null,
          lessonsAdded: 108,
          lessonsRemoved: 0,
          topicsAdded: [
            areaTopics("Ethics", 5),
            areaTopics("Civil Law", 2),
            areaTopics("Labor Law", 2),
            areaTopics("Business Law", 2),
            areaTopics("Civil Procedure", 2),
            areaTopics("Labor Procedure", 2),
          ],
        },
        source: "system",
      },
      planId: plan.id,
      reason: "",
      status: "applied",
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    const note = page.getByRole("region", { name: "Plan change" });

    await expect(note).toContainText(
      "15 topics from Ethics, Civil Law, Labor Law, and 3 other subjects are back in your plan: you missed questions on them.",
    );

    await expect(note).not.toContainText("Ethics topic 1");
    await page.context().close();
  });

  // Missed days on a plan short on time leave topics out: the card names them, whether or not
  // the plan now covers less of the exam.
  for (const behind of [
    null,
    { canFocus: true, coveredAfter: 0.5, coveredBefore: 0.6, currentMinutes: 15, measure: "exam" },
  ]) {
    test(`names the topics missed days leave out of the plan (${behind ? "behind" : "keeping pace"})`, async ({
      browser,
    }) => {
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

      await planChangeFixture({
        kind: "missedDays",
        payload: {
          behind,
          days: 4,
          effect: {
            endDateAfter: null,
            endDateBefore: null,
            lessonsAdded: 0,
            lessonsRemoved: 6,
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

      const note = page.getByRole("region", { name: "Plan change" });

      await expect(note).toContainText("Food chains and Genetics no longer fit by your date.");
      await page.context().close();
    });
  }

  // LEAD ruling (A)/(A′): Today's falling-behind card says only exact facts, and its "more time"
  // and "move date" choices are one link into the plan editor's time a day, where Find and Move
  // your date work out what covers everything when the learner asks.
  test("links days away to the editor's time a day, where moving the date covers it all", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      // Marcos's move came forward to five days away and he missed days: even 4 hours a day can't
      // cover his goal by then, while his 25 minutes cover it all by a later date.
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
        time: {
          fittingDate: "2028-09-28",
          maximum: { coveredShare: 0.49, dailyMinutes: 240 },
          measure: "goal",
          targetDate: soon.toISOString().slice(0, 10),
        },
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

      await editor.getByRole("button", { name: "Move your date to cover everything" }).click();

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

  test("explains the applied phase-end move after a real missed day", async ({ browser }) => {
    const previousDay = toUTCMidnight(new Date(Date.now() - MS_PER_DAY));

    const { built, plan, user } = await createProposalPlan({
      dailyMinutes: 12,
      specs: [
        { area: "Interviews", lessons: 12, name: "Opening the interview", phase: 0 },
        { area: "Interviews", lessons: 60, name: "Follow-up questions", phase: 1 },
      ],
      startDate: previousDay,
    });

    const end = built.phases[0]?.endDate;

    if (!end) {
      throw new Error("The prior-day plan must have a real saved first phase end");
    }

    const originalLessons = await prisma.planItem.findMany({
      orderBy: { id: "asc" },
      select: { id: true, lessonId: true, scheduledFor: true },
      where: { kind: "lesson", planId: plan.id },
    });

    expect(originalLessons).toHaveLength(2);

    expect(originalLessons.map((item) => item.scheduledFor?.toISOString().slice(0, 10))).toContain(
      previousDay.toISOString().slice(0, 10),
    );

    const restDay = new Date(`${end}T00:00:00Z`).getUTCDay();

    await prisma.plan.update({
      data: {
        settings: {
          ...parsePlanSettings(plan.settings),
          weekdayMinutes: Array.from({ length: 7 }, (_, day) => (day === restDay ? 0 : 12)),
        },
      },
      where: { id: plan.id },
    });

    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);

    const page = await openAs(browser, user);
    await page.goto("/today");
    const note = page.getByRole("region", { name: "Plan change" });
    await expect(note.getByRole("button", { name: "Got it" })).toBeVisible();

    // The read computes the exact notice; only the learner's acknowledgment persists it.
    const response = await page.request.get("/api/learner/views/today");
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.status).toBe("ready");
    const shown = body.copy.view.today.planChange;

    expect(shown).toMatchObject({
      canUndo: false,
      id: null,
      kind: "missedDays",
      source: "system",
      status: "applied",
    });

    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);
    const payload = parsePlanChangePayload(shown);
    const move = payload.effect?.phaseEnds?.[0];

    if (!move) {
      throw new Error("The mandatory notice must name the actual first phase-end move");
    }

    expect(payload).toMatchObject({
      behind: null,
      days: 1,
      effect: { lessonsAdded: 0, lessonsRemoved: 0 },
      source: "system",
    });

    expect(payload.effect?.phaseEnds).toStrictEqual([
      { after: move.after, before: end, name: "First interviews" },
    ]);

    expect(Date.parse(move.after)).toBeGreaterThan(Date.parse(end));

    expect(await readText(note)).toContain(
      `First interviews ends ${proposalDate(move.after)} instead of ${proposalDate(end)}.`,
    );

    await expect(page.getByRole("region", { name: "Suggested change" })).toHaveCount(0);
    await expect(note.getByRole("button", { name: "Apply" })).toHaveCount(0);
    await expect(note.getByRole("button", { name: "Keep mine" })).toHaveCount(0);
    await expect(note.getByRole("button", { name: "Undo" })).toHaveCount(0);

    await expect(
      prisma.planItem.findFirstOrThrow({ where: { kind: "boss", phase: 0, planId: plan.id } }),
    ).resolves.toMatchObject({ scheduledFor: new Date(`${end}T00:00:00Z`) });

    const keptLessons = await prisma.planItem.findMany({
      orderBy: { id: "asc" },
      select: { id: true, lessonId: true },
      where: { kind: "lesson", planId: plan.id },
    });

    expect(keptLessons).toStrictEqual(
      originalLessons.map(({ id, lessonId }) => ({ id, lessonId })),
    );

    const actions: string[] = [];

    page.on("request", (request) => {
      if (request.method() === "POST" && request.headers()["next-action"]) {
        actions.push(request.url());
      }
    });

    await note.getByRole("button", { name: "Got it" }).click();
    await expect(note.getByRole("status")).toHaveText("Noted.");

    await expect.poll(() => prisma.planChange.count({ where: { planId: plan.id } })).toBe(1);

    const [acknowledged, savedPlan, savedBoss, savedLessons] = await Promise.all([
      prisma.planChange.findFirstOrThrow({ where: { planId: plan.id } }),
      prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      prisma.planItem.findFirstOrThrow({ where: { kind: "boss", phase: 0, planId: plan.id } }),
      prisma.planItem.findMany({
        orderBy: { id: "asc" },
        select: { id: true, lessonId: true },
        where: { kind: "lesson", planId: plan.id },
      }),
    ]);

    expect(acknowledged.id).toMatch(/^[0-9a-f-]{36}$/u);
    expect(acknowledged).toMatchObject({ kind: "missedDays", status: "applied" });

    expect(parsePlanChangePayload(acknowledged.payload)).toMatchObject({
      acknowledgedRead: { revision: body.copy.revision },
      behind: null,
      days: 1,
      effect: payload.effect,
      seenAt: expect.any(String),
      source: "system",
    });

    expect(parsePlanChangePayload(acknowledged.payload).effect).toStrictEqual(payload.effect);
    expect((savedPlan.phases as { endDate: string | null }[])[0]?.endDate).toBe(move.after);
    expect(savedBoss.scheduledFor).toStrictEqual(new Date(`${move.after}T00:00:00Z`));
    expect(savedLessons).toStrictEqual(keptLessons);
    expect(actions).toHaveLength(1);
    await expect(prisma.studySession.count({ where: { goalId: plan.goalId } })).resolves.toBe(0);

    await page.request.get("/api/learner/views/today");

    await expect(
      prisma.planChange.findUniqueOrThrow({ where: { id: acknowledged.id } }),
    ).resolves.toStrictEqual(acknowledged);

    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(1);

    await page.context().close();
  });

  // An IELTS learner's card lists the tested-out lessons separately from the topics it moves.

  test("lists the topics a test-out brings in and leaves out under the lessons it skipped, and why listening basics left", async ({
    browser,
  }) => {
    const { items, plan, user } = await createChapterPlan();
    const skipped = items.slice(0, 2).map((item) => item.id);

    await prisma.planItem.updateMany({
      data: { status: "testedOut" },
      where: { id: { in: skipped } },
    });

    const page = await openAs(browser, user);
    await page.goto("/today");
    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();

    const { version } = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    await planChangeFixture({
      kind: "testedOut",
      payload: {
        effect: {
          endDateAfter: null,
          endDateBefore: null,
          lessonsAdded: 12,
          lessonsRemoved: 2,
          listeningPastBasics: ["Listening"],
          topicsAdded: [
            {
              area: "Reading",
              topics: ["Writer's stance", "Locating details", "Matching headings", "Gist"],
            },
          ],
          topicsLeftOut: [
            { area: "Listening", topics: ["Spoken sounds"] },
            { area: "Reading", topics: ["References in a text"] },
          ],
        },
        planItemIds: skipped,
        source: "system",
        versionAfter: version,
      },
      planId: plan.id,
      reason: "Placement or a test-out skipped lessons the learner already knows.",
      status: "applied",
    });

    await page.reload();

    const note = page.getByRole("region", { name: "Plan change" });

    await expect(
      note.getByText(
        "Now in your plan: Writer's stance, Locating details, Matching headings and 1 more topic.",
      ),
    ).toBeVisible();

    await expect(
      note.getByText("Out of your plan: Spoken sounds and References in a text."),
    ).toBeVisible();

    // Placement asked no listening: the card says why its basics left and how they're checked.
    await expect(
      note.getByText(
        "Your answers show you know the basics of Listening. Practice with recordings will check them.",
      ),
    ).toBeVisible();

    await expect(note.getByText(/fits? by your date/u)).toHaveCount(0);
    await page.context().close();
  });

  test("says which chapter a test-out skipped and puts its lessons back on Undo", async ({
    browser,
  }) => {
    const { chapter, items, plan, user } = await createChapterPlan();
    const skipped = items.slice(0, 2).map((item) => item.id);

    await prisma.planItem.updateMany({
      data: { status: "testedOut" },
      where: { id: { in: skipped } },
    });

    // The plan re-plans around the skip when Today first opens, as the test-out does right away.
    const page = await openAs(browser, user);
    await page.goto("/today");
    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();

    const { version } = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    const change = await planChangeFixture({
      kind: "testedOut",
      payload: { planItemIds: skipped, source: "system", versionAfter: version },
      planId: plan.id,
      reason: "Placement or a test-out skipped lessons the learner already knows.",
      status: "applied",
    });

    await page.reload();

    const note = page.getByRole("region", { name: "Plan change" });
    await expect(note).toContainText(`We skipped 2 lessons of ${chapter.title}`);
    await expect(note.getByRole("button", { name: "Got it" })).toBeVisible();

    await note.getByRole("button", { name: "Undo" }).click();
    await expect(note.getByRole("status")).toHaveText("The lessons are back in your plan.");

    await expect.poll(() => readChangeStatus(change.id)).toBe("undone");

    await expect
      .poll(() => prisma.planItem.count({ where: { id: { in: skipped }, status: "todo" } }))
      .toBe(skipped.length);

    // Answered, it leaves Today.
    await page.reload();
    await expect(page.getByRole("region", { name: "Plan change" })).toHaveCount(0);
    await page.context().close();
  });
});
