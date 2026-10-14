import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getChallenge } from "../../checkpoints/get-challenge";
import { examStructureSchema } from "../../library/exams/blueprint-contract";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { readBlockPayload } from "../../sessions/block-payload";
import { getTodayView } from "../../view-models/today/get-today-view";
import { getMock } from "./get-mock";
import { mockConditionsSchema } from "./mock-contract";
import { startMock } from "./start-mock";

const NOW = new Date("2020-10-12T12:00:00Z");
const EVENT_DATE = "2020-10-09";

const STRUCTURE = examStructureSchema.parse({
  formats: [],
  mock: {
    citations: [],
    order: null,
    scoring: { description: "One point per correct answer", method: "raw" },
    sections: [
      { day: 1, minutes: 330, name: "Languages", questions: 90 },
      { day: 2, minutes: 300, name: "Math", questions: 90 },
    ],
    timeLimitMinutes: 630,
    totalQuestions: 180,
  },
  rules: [],
  subjects: [],
});

/** Already taught curriculum, a skipped first sitting, and the announced second sitting missed. */
async function overduePlan() {
  const [user, blueprint, languages, math] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ structure: STRUCTURE }),
    skillFixture({ name: "Languages" }),
    skillFixture({ name: "Math" }),
  ]);

  const skills = [languages, math];

  const goal = await goalFixture({
    createdAt: new Date("2020-09-28"),
    dailyMinutes: 30,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    timezone: "UTC",
    userId: user.id,
  });

  const plan = await planFixture({
    estimateHours: 1,
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Review" }],
      skills: skills.map((skill) => ({
        area: skill.name,
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
    phases: [{ kind: "practice", name: "Review", startDate: "2020-09-28" }],
    settings: {
      mockFunding: [
        { contributions: [], date: "2020-10-02", day: 1, fullLength: false, minutes: 165 },
        { contributions: [], date: EVENT_DATE, day: 2, fullLength: false, minutes: 150 },
      ],
      startDate: "2020-09-28",
      weekdayMinutes: [30, 30, 30, 30, 30, 30, 30],
    },
  });

  const banks = await Promise.all(
    skills.map(async (skill, position) => {
      const lesson = await libraryLessonFixture();

      const questions = await Promise.all(
        Array.from({ length: 6 }, () =>
          itemFixture({
            content: choiceItemContent(),
            examBlueprintId: blueprint.id,
            skillId: skill.id,
          }),
        ),
      );

      await Promise.all([
        lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
        planItemFixture({
          completedAt: new Date("2020-10-08T12:00:00Z"),
          lessonId: lesson.id,
          planId: plan.id,
          position,
          scheduledFor: new Date("2020-10-08"),
          skillId: skill.id,
          status: "done",
        }),
      ]);

      return questions;
    }),
  );

  const [skipped, mock] = await Promise.all([
    planItemFixture({
      kind: "mock",
      planId: plan.id,
      position: 2,
      scheduledFor: new Date("2020-10-02"),
      status: "skipped",
    }),
    planItemFixture({
      kind: "mock",
      planId: plan.id,
      position: 3,
      scheduledFor: new Date(EVENT_DATE),
    }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  mockSession(user.id);
  return { goal, mathQuestions: banks[1] ?? [], mock, plan, skipped };
}

describe("an overdue scheduled mock's canonical identity", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("keeps its announced day-two clock and sections when returning after a skipped mock", async () => {
    const { goal, mathQuestions, mock, plan, skipped } = await overduePlan();
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const intro = await getChallenge({ input: { timeZone: "UTC" }, planItemId: mock.id });
    expect.soft(intro).toMatchObject({ challenge: { minutes: 150 }, status: "ready" });

    const today = await getTodayView({ goalId: goal.id, timeZone: "UTC" });

    if (today.status !== "ready") {
      throw new Error("Expected the actual late-return Today");
    }

    const block = today.today.session.blocks.find((entry) => entry.checkpoint?.mock);

    if (!block) {
      throw new Error("Expected the overdue mock's actual session block");
    }

    expect.soft(block.estimatedMinutes).toBe(150);
    const saved = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });
    expect(readBlockPayload(saved).planItemId).toBe(mock.id);

    expect
      .soft(new Set(readBlockPayload(saved).itemIds))
      .toStrictEqual(new Set(mathQuestions.map((question) => question.id)));

    await expect(getMock(block.id)).resolves.toMatchObject({
      mock: { day: 2, fullLength: false, minutes: 150 },
      status: "ready",
    });

    await expect(
      startMock({ blockId: block.id, input: { timeZone: "UTC" } }),
    ).resolves.toMatchObject({ status: "ready" });

    const sitting = await prisma.mockExam.findUniqueOrThrow({ where: { blockId: block.id } });
    const conditions = mockConditionsSchema.parse(sitting.conditions);
    expect(conditions).toMatchObject({ day: 2, fullLength: false });

    expect(conditions.sections.reduce((minutes, section) => minutes + section.minutes, 0)).toBe(
      150,
    );

    const after = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(parsePlanSettings(after.settings).mockFunding).toStrictEqual(
      parsePlanSettings(before.settings).mockFunding,
    );

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: skipped.id } }),
    ).resolves.toMatchObject({ status: "skipped" });
  });
});
