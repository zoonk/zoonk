import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  lessonSkillFixture,
  libraryLessonFixture,
  libraryLessonsFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getChallenge } from "../../checkpoints/get-challenge";
import { examStructureSchema } from "../../library/exams/blueprint-contract";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { openTodayView } from "../../sessions/_test-utils/open-today-view";
import { loadSessionBuildInput } from "../../sessions/_utils/load-build-inputs";
import { hasSessionLessonReservation } from "../../sessions/_utils/session-lesson-reservation";
import { readBlockPayload } from "../../sessions/block-payload";
import { buildSessionBlocks } from "../../sessions/session-builder";
import { getTodayView } from "../../view-models/today/get-today-view";
import { getMock } from "./get-mock";
import { mockConditionsSchema } from "./mock-contract";
import { startMock } from "./start-mock";

const NOW = new Date("2020-10-12T12:00:00Z");
const EVENT_DATE = "2020-10-09";

const STRUCTURE = examStructureSchema.parse({
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "One point per correct answer", method: "raw" },
    sections: [
      { day: 1, kind: "objective", minutes: 330, name: "Languages", questions: 90 },
      { day: 2, kind: "objective", minutes: 300, name: "Math", questions: 90 },
    ],
    timeLimitMinutes: 630,
    totalQuestions: 180,
  },
  rules: [],
  subjects: [],
});

async function overduePlan({ dailyMinutes = 30, mockMinutes = 150, structure = STRUCTURE } = {}) {
  const [user, blueprint, languages, math] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ structure }),
    skillFixture({ name: "Languages" }),
    skillFixture({ name: "Math" }),
  ]);

  const skills = [languages, math];

  const goal = await goalFixture({
    createdAt: new Date("2020-09-28"),
    dailyMinutes,
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
        { contributions: [], date: EVENT_DATE, day: 2, fullLength: false, minutes: mockMinutes },
      ],
      startDate: "2020-09-28",
      weekdayMinutes: Array.from({ length: 7 }, () => dailyMinutes),
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
  return { goal, languages, math, mathQuestions: banks[1] ?? [], mock, plan, skipped, user };
}

describe("an overdue scheduled mock's canonical identity", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("fills an ordinary day around a carried mock and reserves lessons still being written", async () => {
    const { goal, languages, math, mock, plan, user } = await overduePlan({
      dailyMinutes: 60,
      mockMinutes: 20,
      structure: examStructureSchema.parse({
        ...STRUCTURE,
        mock: {
          ...STRUCTURE.mock,
          sections: [
            { day: 1, kind: "objective", minutes: 40, name: "Languages", questions: 12 },
            { day: 2, kind: "objective", minutes: 40, name: "Math", questions: 12 },
          ],
          timeLimitMinutes: 80,
          totalQuestions: 24,
        },
      }),
    });

    const lessons = await libraryLessonsFixture(8, { estimatedMinutes: 6 });

    await Promise.all([
      dailyProgressFixtureMany([
        { date: new Date("2020-10-11"), timeSpentSeconds: 600, userId: user.id },
      ]),
      ...lessons.map(async (lesson, position) => {
        const skillId = position < 2 ? math.id : languages.id;
        await lessonSkillFixture({ lessonId: lesson.id, skillId });

        return planItemFixture({
          lessonId: lesson.id,
          minutes: 6,
          planId: plan.id,
          position: position + 4,
          scheduledFor: new Date(position < 2 ? "2020-10-12" : "2020-10-13"),
          skillId,
        });
      }),
    ]);

    const input = await loadSessionBuildInput({
      goal,
      localDate: new Date("2020-10-12"),
      now: NOW,
      timeZone: "UTC",
      userId: user.id,
    });

    const built = buildSessionBlocks(input);

    expect.soft(input.freshStart).toBeNull();
    expect.soft(input.mockReplacesDay).toBe(false);

    expect
      .soft(built.blocks.map((block) => block.kind))
      .toStrictEqual(["learn", "learn", "learn", "learn", "learn", "learn", "checkpoint"]);

    expect.soft(built.plannedMinutes).toBe(60);
    expect.soft(built.blocks.at(-1)?.payload.planItemId).toBe(mock.id);

    const blocks = built.blocks.filter(
      (block, index) => index < 2 || block.payload.checkpoint?.mock,
    );

    const held = new Set(blocks.flatMap((block) => block.lessonId ?? []));

    await prisma.planItem.updateMany({
      data: { lessonId: null, scheduledFor: new Date("2020-10-12") },
      where: {
        lessonId: { in: lessons.filter((lesson) => !held.has(lesson.id)).map(({ id }) => id) },
      },
    });

    const saved = await prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { id: plan.id },
    });

    expect(
      hasSessionLessonReservation({
        access: { includesMockExams: true, trialEnded: false },
        plan: saved,
        session: {
          blocks: blocks.map((block) => ({ ...block, status: "completed" })),
          freshStart: null,
          goal,
          localDate: new Date("2020-10-12"),
          plannedMinutes: 60,
        },
      }),
    ).toBe(true);
  });

  it("keeps its announced day-two clock and sections when returning after a skipped mock", async () => {
    const { goal, mathQuestions, mock, plan, skipped } = await overduePlan();
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const intro = await getChallenge({ input: { timeZone: "UTC" }, planItemId: mock.id });
    expect.soft(intro).toMatchObject({ challenge: { minutes: 150 }, status: "ready" });

    await expect(getTodayView({ goalId: goal.id, timeZone: "UTC" })).resolves.toMatchObject({
      status: "ready",
    });

    const afterRead = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(parsePlanSettings(afterRead.settings).mockFunding).toStrictEqual(
      parsePlanSettings(before.settings).mockFunding,
    );

    const today = await openTodayView({ goalId: goal.id, timeZone: "UTC" });

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

    expect(
      parsePlanSettings(after.settings).mockFunding.filter((entry) => entry.date === EVENT_DATE),
    ).toStrictEqual(
      parsePlanSettings(before.settings).mockFunding.filter((entry) => entry.date === EVENT_DATE),
    );

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: skipped.id } }),
    ).resolves.toMatchObject({ status: "skipped" });
  });
});
