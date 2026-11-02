import { prisma } from "@zoonk/db";
import { layOutPlanFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import {
  listeningBlueprintFixture,
  listeningContent,
  listeningSetFixture,
} from "@zoonk/testing/fixtures/listening";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getChallenge } from "../../checkpoints/get-challenge";
import { type ExamStructure, examStructureSchema } from "../../library/exams/blueprint-contract";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { planLibraryFixture, unplannedGoalFixture } from "../../plans/_test-utils/plan-library";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { openTodayView } from "../../sessions/_test-utils/open-today-view";
import { listListeningParts } from "../listening/listening-parts";
import { getMock } from "./get-mock";
import { mockConditionsSchema } from "./mock-contract";
import { getMockClock } from "./mock-plan";
import { startMock } from "./start-mock";

const START = "2020-09-28";
const MOCK_DAY = "2020-10-09";
const FULL_DAY = MOCK_DAY;

const TWO_OBJECTIVE = examStructureSchema.parse({
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "One point per correct answer", method: "raw" },
    sections: [
      { day: 1, kind: "objective", minutes: 60, name: "Math", questions: 40 },
      { day: 1, kind: "objective", minutes: 60, name: "Science", questions: 40 },
    ],
    timeLimitMinutes: 120,
    totalQuestions: 80,
  },
  rules: [],
  subjects: [],
});

async function setup({
  blueprint,
  fullLength = false,
  structure,
}: {
  blueprint?: Awaited<ReturnType<typeof examBlueprintFixture>>;
  fullLength?: boolean;
  structure: ExamStructure;
}) {
  const startDate = START;
  const dailyMinutes = fullLength ? 90 : 60;
  vi.setSystemTime(new Date(`${startDate}T12:00:00Z`));

  const [user, exam, library] = await Promise.all([
    userFixture(),
    blueprint ?? examBlueprintFixture({ structure }),
    planLibraryFixture({
      skills: [
        { area: structure.mock?.sections[0]?.name, lessons: 60 },
        ...(structure.mock?.sections.some((section) => section.kind === "listening")
          ? [{ area: "Listening", lessons: 1 }]
          : []),
      ],
    }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    createdAt: new Date(startDate),
    dailyMinutes,
    details: { placementDeclined: true },
    examBlueprintId: exam.id,
    kind: "exam",
    settings: {
      startDate,
      weekdayMinutes: [0, dailyMinutes, dailyMinutes, dailyMinutes, dailyMinutes, dailyMinutes, 0],
    },
    targetDate: fullLength ? new Date("2020-10-14") : null,
    targetLanguage: "en",
    timezone: "UTC",
    userId: user.id,
  });

  await prisma.subscription.create({
    data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
  });

  await prisma.lesson.updateMany({
    data: { estimatedMinutes: 10 },
    where: { id: { in: library.lessons.map((lesson) => lesson.id) } },
  });

  if (fullLength) {
    await prisma.plan.update({
      data: {
        graph: library.graph,
        phases: [{ kind: "finalStretch", name: "Final stretch", startDate: MOCK_DAY }],
        settings: {
          mockFunding: [
            {
              contributions: [],
              date: MOCK_DAY,
              day: structure.mock?.sections[0]?.day ?? null,
              fullLength: true,
              minutes: getMockClock({
                day: structure.mock?.sections[0]?.day ?? null,
                fullLength: true,
                structure,
              }),
            },
          ],
          startDate,
          weekdayMinutes: [0, 90, 90, 90, 90, 90, 0],
        },
      },
      where: { id: plan.id },
    });

    await Promise.all(
      library.skills.map((skill, index) =>
        planItemFixture({
          kind: "lesson",
          lessonId: library.lessons.find((lesson) =>
            lesson.title.startsWith(`Lesson ${index + 1}.`),
          )?.id,
          planId: plan.id,
          position: index,
          scheduledFor: new Date("2020-10-12"),
          skillId: skill.id,
        }),
      ),
    );

    await planItemFixture({
      kind: "mock",
      planId: plan.id,
      position: library.skills.length,
      scheduledFor: new Date(MOCK_DAY),
    });

    await layOutPlanFixture(plan.id);
  } else {
    const created = await createGoalPlan({ goalId: goal.id, graph: library.graph });

    if (created.status !== "created") {
      throw new Error(`Expected the real planner-created plan: ${created.status}`);
    }
  }

  mockSession(user.id);

  const original = await prisma.planItem.findFirstOrThrow({
    where: { kind: "mock", planId: plan.id, scheduledFor: new Date(MOCK_DAY) },
  });

  const planItemId = original.id;
  const date = fullLength ? FULL_DAY : MOCK_DAY;
  const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

  const funding = parsePlanSettings(saved.settings).mockFunding.find(
    (entry) => entry.date === date,
  );

  expect(funding).toMatchObject({ fullLength, minutes: fullLength ? 90 : 60 });
  return { date, fromPlanner: !fullLength, goal, library, plan, planItemId };
}

async function assertScheduledClock({
  date,
  fromPlanner,
  goal,
  minutes,
  plan,
  planItemId,
  questions,
}: Awaited<ReturnType<typeof setup>> & { minutes: number; questions: number }) {
  vi.setSystemTime(new Date(`${date}T12:00:00Z`));
  const challenge = await getChallenge({ input: { timeZone: "UTC" }, planItemId });
  expect.soft(challenge).toMatchObject({ challenge: { minutes, questions }, status: "ready" });

  const [view, today] = await Promise.all([
    getGoalPlan(goal.id),
    openTodayView({ goalId: goal.id, timeZone: "UTC" }),
  ]);

  if (view.status !== "ready" || today.status !== "ready") {
    throw new Error("Expected the actual scheduled Plan and Today");
  }

  const row = view.plan.week.days
    .flatMap((day) => day.items)
    .find((item) => item.id === planItemId);

  expect(row).toMatchObject({ scheduledFor: date });
  expect(row?.minutes).toBe(fromPlanner ? minutes : null);
  expect(view.plan.week.days.find((day) => day.date === date)?.minutes).toBe(minutes);
  const block = today.today.session.blocks.find((entry) => entry.checkpoint?.mock);

  if (!block) {
    throw new Error("Expected the actual scheduled mock block");
  }

  expect.soft(block.estimatedMinutes).toBe(minutes);
  const ready = await getMock(block.id);
  expect.soft(ready).toMatchObject({ mock: { minutes, questions }, status: "ready" });

  await expect(startMock({ blockId: block.id, input: { timeZone: "UTC" } })).resolves.toMatchObject(
    { status: "ready" },
  );

  const sitting = await prisma.mockExam.findUniqueOrThrow({ where: { blockId: block.id } });
  const conditions = mockConditionsSchema.parse(sitting.conditions);
  expect.soft(conditions.sections.reduce((sum, section) => sum + section.minutes, 0)).toBe(minutes);

  expect(
    conditions.sections.every((section) => section.itemIds.length + section.essays.length > 0),
  ).toBe(true);

  expect.soft(conditions.sections.flatMap((section) => section.itemIds)).toHaveLength(questions);
  const running = await getMock(block.id);

  expect
    .soft(running)
    .toMatchObject({ mock: { minutes, questions, status: "running" }, status: "ready" });

  const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

  expect(
    parsePlanSettings(saved.settings).mockFunding.find((entry) => entry.date === date)?.minutes,
  ).toBe(minutes);

  return conditions;
}

describe("a scheduled mock's playable sections keep the funded clock", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${START}T12:00:00Z`));
  });

  afterEach(() => vi.useRealTimers());

  it("keeps 60 minutes when only the first of two objective sections has six questions", async () => {
    const fixture = await setup({ structure: TWO_OBJECTIVE });

    await Promise.all(
      Array.from({ length: 6 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: fixture.library.skills[0]?.id ?? "" }),
      ),
    );

    const conditions = await assertScheduledClock({ ...fixture, minutes: 60, questions: 6 });
    expect(conditions.sections).toHaveLength(1);
    expect(conditions.sections[0]).toMatchObject({ minutes: 60, name: "Math", questions: 6 });
  });

  it("loads real voiced listening recordings in a scheduled 90-minute full mock", async () => {
    const blueprint = await listeningBlueprintFixture({
      name: `Scheduled listening ${crypto.randomUUID()}`,
    });

    const structure = readBlueprintContent(blueprint).structure;
    const fixture = await setup({ blueprint, fullLength: true, structure });
    const skillId = fixture.library.skills[0]?.id ?? "";
    const parts = listListeningParts(structure);

    const sets = await Promise.all(
      parts.map(async (part) => {
        const media = await mediaAssetFixture();

        const set = await listeningSetFixture({
          content: { ...listeningContent(), task: part.task },
          examBlueprintId: blueprint.id,
          mediaAssetId: media.id,
        });

        await Promise.all(
          [0, 1].map((setPosition) =>
            itemFixture({
              content: choiceItemContent(),
              examBlueprintId: blueprint.id,
              setId: set.id,
              setPosition,
              skillId: fixture.library.skills[1]?.id ?? "",
            }),
          ),
        );

        return set;
      }),
    );

    await Promise.all(
      Array.from({ length: 6 }, () =>
        itemFixture({ content: choiceItemContent(), examBlueprintId: blueprint.id, skillId }),
      ),
    );

    const conditions = await assertScheduledClock({ ...fixture, minutes: 90, questions: 10 });

    expect.soft(conditions.sections).toMatchObject([
      { minutes: 60, name: "Reading", questions: 6 },
      { kind: "listening", minutes: 30, name: "Listening", questions: 4 },
    ]);

    const listeningIds =
      conditions.sections.find((section) => section.kind === "listening")?.itemIds ?? [];

    const recordings = await prisma.item.findMany({ where: { id: { in: listeningIds } } });
    expect(recordings).toHaveLength(4);
    expect(recordings.every((item) => sets.some((set) => set.id === item.setId))).toBe(true);
  });

  it("keeps a missing written section's time without creating an empty playback section", async () => {
    const structure = examStructureSchema.parse({
      ...TWO_OBJECTIVE,
      mock: {
        ...TWO_OBJECTIVE.mock,
        sections: [
          { day: 1, kind: "objective", minutes: 60, name: "Math", questions: 40 },
          { day: 1, kind: "written", minutes: 30, name: "Writing", questions: null },
        ],
        timeLimitMinutes: 90,
        totalQuestions: 40,
      },
    });

    const fixture = await setup({ fullLength: true, structure });

    await Promise.all(
      Array.from({ length: 6 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: fixture.library.skills[0]?.id ?? "" }),
      ),
    );

    const conditions = await assertScheduledClock({ ...fixture, minutes: 90, questions: 6 });
    expect(conditions.sections).toHaveLength(1);
    expect(conditions.sections[0]).toMatchObject({ essays: [], minutes: 90, questions: 6 });
  });
});
