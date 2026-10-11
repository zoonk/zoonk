import { prisma } from "@zoonk/db";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonsFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  choiceItemContent,
  itemFixture,
  skillPrerequisiteFixture,
} from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { answerPlacementQuestion } from "../learner/placement/answer-placement-question";
import { finishGoalPlacement } from "../learner/placement/finish-goal-placement";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));

/** A Monday in 2020, before the learning events other tests write, six weeks before the exam. */
const NOW = new Date("2020-09-28T12:00:00Z");
const TODAY = "2020-09-28";
const RIGHT = { selectedIndex: 0 };
const LESSONS_PER_SKILL = 12;

/**
 * An adult's public-service exam whose skills are still one stand-in each while placement runs:
 * a Portuguese foundation (word classes, which the exam doesn't ask on its own), rewriting at the
 * exam's depth, logic and law.
 */
async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: [
      { area: "Portuguese", lessons: 0, size: LESSONS_PER_SKILL, weight: 1 },
      { area: "Portuguese", lessons: 0, size: LESSONS_PER_SKILL, weight: 5 },
      { area: "Logic", lessons: 0, size: LESSONS_PER_SKILL, weight: 4 },
      { area: "Law", lessons: 0, size: LESSONS_PER_SKILL, weight: 3 },
    ],
  });

  const [foundation, rewrite] = library.skills;

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 60,
    kind: "exam",
    settings: { startDate: TODAY },
    targetDate: new Date("2020-11-08T00:00:00Z"),
    userId: user.id,
  });

  const [items] = await Promise.all([
    Promise.all(
      [1, 2].map(() =>
        itemFixture({ content: choiceItemContent(), skillId: foundation?.id ?? "" }),
      ),
    ),
    skillPrerequisiteFixture({ prerequisiteId: foundation?.id ?? "", skillId: rewrite?.id ?? "" }),
  ]);

  mockSession(user.id);

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: new Date(`${TODAY}T00:00:00Z`),
    currentInstant: NOW,
    timeZone: "UTC",
  });

  return { goal, items, library, plan };
}

/**
 * The course outlines land: each skill gets its chapter's lessons, written a chapter at a time so
 * the test doesn't wait on a round trip per lesson.
 */
async function outlineSkills(skillIds: readonly string[]) {
  await Promise.all(
    skillIds.map(async (skillId) => {
      const [chapter, lessons] = await Promise.all([
        libraryChapterFixture({ title: `Chapter ${skillId}` }),
        libraryLessonsFixture(LESSONS_PER_SKILL, { estimatedMinutes: 3 }),
      ]);

      await Promise.all([
        prisma.chapterLesson.createMany({
          data: lessons.map((lesson, position) => ({
            chapterId: chapter.id,
            lessonId: lesson.id,
            position,
          })),
        }),
        prisma.lessonSkill.createMany({
          data: lessons.map((lesson) => ({ lessonId: lesson.id, skillId })),
        }),
      ]);
    }),
  );
}

describe("an exam plan after placement", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps what placement showed the learner knows out once its lessons are outlined, and mixes the exam's areas from day 1", async () => {
    const { goal, items, library, plan } = await setup();
    const [foundation, rewrite] = library.skills;

    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    await Promise.all(
      items.map((item) =>
        answerPlacementQuestion({
          goalId: goal.id,
          input: { answer: RIGHT, durationMs: 4000, itemId: item.id, timeZone: "UTC" },
        }),
      ),
    );

    const finished = await finishGoalPlacement({ goalId: goal.id, input: { timeZone: "UTC" } });

    expect(finished.status === "ready" && finished.completion.knownSkillIds).toContain(
      foundation?.id,
    );

    await outlineSkills(library.skills.map((skill) => skill.id));
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const planned = await prisma.planItem.findMany({
      include: { lesson: { select: { skills: { select: { skillId: true } } } } },
      orderBy: { position: "asc" },
      where: { kind: "lesson", planId: plan.id, status: "todo" },
    });

    const skillOf = (item: (typeof planned)[number]) =>
      item.skillId ?? item.lesson?.skills[0]?.skillId ?? null;

    expect(planned.some((item) => skillOf(item) === foundation?.id)).toBe(false);
    const [first] = planned;

    expect(first && skillOf(first)).toBe(rewrite?.id);

    const dayOne = planned.filter(
      (item) => item.scheduledFor?.toISOString().slice(0, 10) === TODAY,
    );

    const areaOf = (item: (typeof planned)[number]) =>
      library.graph.skills.find((skill) => skill.skillId === skillOf(item))?.area;

    expect(new Set(dayOne.map((item) => areaOf(item))).size).toBeGreaterThanOrEqual(2);
    expect(dayOne.length).toBeGreaterThan(0);
  });
});

/** An answer placement grades wrong: the fixture's choice items have their right option first. */
const WRONG = { selectedIndex: 1 };

/**
 * A law exam four weeks away at 10 minutes a day: its time keeps the core of some of its skills,
 * asked alike, in teaching order.
 */
async function shortExamSetup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: Array.from({ length: 16 }, () => ({ area: "Law", lessons: 9, weight: 3 })),
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 10,
    kind: "exam",
    settings: { startDate: TODAY },
    targetDate: new Date("2020-10-26T00:00:00Z"),
    userId: user.id,
  });

  mockSession(user.id);

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: new Date(`${TODAY}T00:00:00Z`),
    currentInstant: NOW,
    timeZone: "UTC",
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  return { goal, library, plan };
}

/** The skills the plan has lessons on still to do. */
async function listPlannedSkills(planId: string): Promise<Set<string>> {
  const items = await prisma.planItem.findMany({
    include: { lesson: { select: { skills: { select: { skillId: true } } } } },
    where: { kind: "lesson", planId, status: "todo" },
  });

  return new Set(
    items.flatMap((item) =>
      item.skillId ? [item.skillId] : (item.lesson?.skills.map((skill) => skill.skillId) ?? []),
    ),
  );
}

describe("an exam plan short on time when placement ends", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Placement skipped nothing, so nothing re-planned, and a topic it found missing stayed out
  // while topics asked as often, which the learner wasn't asked about, kept their lessons. A miss
  // ranks first among topics asked alike.
  it("brings in a topic placement found missing even when it skipped nothing", async () => {
    const { goal, library, plan } = await shortExamSetup();
    const planned = await listPlannedSkills(plan.id);
    const missing = library.skills.find((skill) => !planned.has(skill.id));

    expect(missing).toBeDefined();

    const item = await itemFixture({ content: choiceItemContent(), skillId: missing?.id ?? "" });

    await answerPlacementQuestion({
      goalId: goal.id,
      input: { answer: WRONG, durationMs: 4000, itemId: item.id, timeZone: "UTC" },
    });

    const finished = await finishGoalPlacement({ goalId: goal.id, input: { timeZone: "UTC" } });

    expect(finished).toMatchObject({ completion: { testedOutPlanItemIds: [] }, status: "ready" });
    await expect(listPlannedSkills(plan.id)).resolves.toContain(missing?.id);

    // Today says it was their answers that changed what fits.
    const changes = await prisma.planChange.findMany({ where: { planId: plan.id } });

    expect(changes).toMatchObject([
      { kind: "coverageChanged", payload: { effect: { fromPlacement: true } }, status: "applied" },
    ]);
  });
});
