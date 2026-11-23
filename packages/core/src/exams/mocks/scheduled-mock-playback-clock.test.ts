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
import { CGU_WRITTEN_GRADING } from "./_test-utils/cgu-written";
import { getMock } from "./get-mock";
import { mockConditionsSchema } from "./mock-contract";
import { getMockClock } from "./mock-plan";
import { listMockPrepWrites } from "./prepare-mock-questions";
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

  it("keeps a short 60-minute mock preparing and offers the next available study block", async () => {
    const fixture = await setup({ structure: TWO_OBJECTIVE });

    await Promise.all(
      Array.from({ length: 6 }, () =>
        itemFixture({
          content: choiceItemContent(),
          examBlueprintId: fixture.goal.examBlueprintId,
          mockOnly: true,
          skillId: fixture.library.skills[0]?.id ?? "",
        }),
      ),
    );

    await itemFixture({
      content: choiceItemContent(),
      examBlueprintId: fixture.goal.examBlueprintId,
      skillId: fixture.library.skills[0]!.id,
    });

    vi.setSystemTime(new Date(`${fixture.date}T12:00:00Z`));
    const today = await openTodayView({ goalId: fixture.goal.id, timeZone: "UTC" });

    if (today.status !== "ready") {
      throw new Error(today.status);
    }

    const block = today.today.session.blocks.find((b) => b.checkpoint?.mock);

    if (!block) {
      throw new Error("Expected scheduled block");
    }

    expect.soft(block).toMatchObject({ preparing: true });

    const next = today.today.session.blocks.find(
      (entry) => entry.position === today.today.session.nextPosition,
    );

    expect.soft(next).toMatchObject({ kind: "practice", questions: 1, status: "pending" });
    expect.soft(today.today.session.nextBlockId).not.toBe(block.id);

    await expect(
      getChallenge({ input: {}, planItemId: block.planItemId ?? "" }),
    ).resolves.toMatchObject({ challenge: { access: "preparing" } });

    expect(today.today.weeklyChallenge).toMatchObject({
      access: "preparing",
      questions: 40,
      timeLimitMinutes: 60,
    });

    await expect(startMock({ blockId: block.id, input: {} })).resolves.toStrictEqual({
      status: "preparing",
    });

    await expect(prisma.mockExam.count({ where: { blockId: block.id } })).resolves.toBe(0);

    await expect(
      prisma.studySessionBlock.findUnique({ where: { id: block.id } }),
    ).resolves.toMatchObject({ startedAt: null });
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
          mockOnly: true,
        });

        await Promise.all(
          [0, 1].map((setPosition) =>
            itemFixture({
              content: choiceItemContent(),
              examBlueprintId: blueprint.id,
              mockOnly: true,
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
      Array.from({ length: 40 }, () =>
        itemFixture({
          content: choiceItemContent(),
          examBlueprintId: blueprint.id,
          mockOnly: true,
          skillId,
        }),
      ),
    );

    const conditions = await assertScheduledClock({ ...fixture, minutes: 90, questions: 44 });

    expect.soft(conditions.sections).toMatchObject([
      { minutes: 60, name: "Reading", questions: 40 },
      { kind: "listening", minutes: 30, name: "Listening", questions: 4 },
    ]);

    const listeningIds =
      conditions.sections.find((section) => section.kind === "listening")?.itemIds ?? [];

    const recordings = await prisma.item.findMany({ where: { id: { in: listeningIds } } });
    expect(recordings).toHaveLength(4);
    expect(recordings.every((item) => sets.some((set) => set.id === item.setId))).toBe(true);
  });

  it("keeps the scheduled full clock and waits for the missing written prompt", async () => {
    const structure = examStructureSchema.parse({
      ...TWO_OBJECTIVE,
      mock: {
        ...TWO_OBJECTIVE.mock,
        sections: [
          { day: 1, kind: "objective", minutes: 60, name: "Math", questions: 40 },
          {
            day: 1,
            kind: "written",
            minutes: 30,
            name: "Writing",
            questions: null,
            tasks: [
              {
                count: 1,
                description: "Explain the rule",
                grading: CGU_WRITTEN_GRADING,
                key: "rule",
              },
            ],
          },
        ],
        timeLimitMinutes: 90,
        totalQuestions: 40,
      },
    });

    const fixture = await setup({ fullLength: true, structure });

    await Promise.all(
      Array.from({ length: 40 }, () =>
        itemFixture({
          content: choiceItemContent(),
          examBlueprintId: fixture.goal.examBlueprintId,
          mockOnly: true,
          skillId: fixture.library.skills[0]?.id ?? "",
        }),
      ),
    );

    vi.setSystemTime(new Date(`${fixture.date}T12:00:00Z`));
    const today = await openTodayView({ goalId: fixture.goal.id, timeZone: "UTC" });

    if (today.status !== "ready") {
      throw new Error("Expected the scheduled block");
    }

    const block = today.today.session.blocks.find((entry) => entry.checkpoint?.mock);

    if (!block) {
      throw new Error("Expected the scheduled mock block");
    }

    expect(block).toMatchObject({ preparing: true });

    await expect(getMock(block.id)).resolves.toMatchObject({
      mock: {
        minutes: 90,
        questions: 40,
        sections: [
          { essays: 0, questions: 40 },
          { essays: 1, minutes: 30, questions: 0 },
        ],
      },
    });

    await expect(
      getChallenge({ input: {}, planItemId: fixture.planItemId }),
    ).resolves.toMatchObject({
      challenge: {
        access: "preparing",
        fullLength: true,
        written: [{ asked: true, minutes: 30, name: "Writing" }],
      },
    });

    const paper = new Date(fixture.date).toISOString();
    const start = () => startMock({ blockId: block.id, input: { timeZone: "UTC" } });

    await expect(start()).resolves.toStrictEqual({ status: "preparing" });
    await expect(prisma.mockExam.count({ where: { blockId: block.id } })).resolves.toBe(0);

    await expect(
      prisma.followUp.findFirst({ where: { key: fixture.goal.id, kind: "prepareMockSupply" } }),
    ).resolves.toMatchObject({ input: { later: false, paper } });

    await expect(
      listMockPrepWrites({ goalId: fixture.goal.id, only: paper, priority: paper }),
    ).resolves.toMatchObject({
      papers: [
        {
          key: paper,
          writes: [],
          writing: [
            {
              count: 1,
              goalId: fixture.goal.id,
              taskKey: "rule",
              unit: "answer",
              userId: fixture.goal.userId,
            },
          ],
        },
      ],
    });

    const skillId = fixture.library.skills[0]!.id;

    const essay = await itemFixture({
      content: {
        context: null,
        keyPoints: ["Apply the rule"],
        question: "Explain the rule.",
        rubric: [{ criterion: "Application", description: "Apply the rule.", points: null }],
        sampleOutline: "Rule then facts",
        writing: {
          aspects: [],
          assessedSkillIds: [skillId],
          charactersPerLine: 55,
          criteria: [],
          grading: CGU_WRITTEN_GRADING,
          keySource: "practiceKey",
          lines: null,
          minimumWords: 1,
          points: null,
          taskKey: "rule",
          title: "Explain the rule",
          unit: "answer",
        },
      },
      examBlueprintId: fixture.goal.examBlueprintId,
      format: "essay",
      skillId,
    });

    await expect(start()).resolves.toStrictEqual({ status: "ready" });

    await expect(
      prisma.writingAdmission.findMany({ where: { userId: fixture.goal.userId } }),
    ).resolves.toMatchObject([{ extra: false, itemIds: [essay.id] }]);

    await expect(
      prisma.mockExam.findUnique({ where: { blockId: block.id } }),
    ).resolves.toMatchObject({
      conditions: {
        sections: [{ questions: 40 }, { essays: [essay.id], minutes: 30, questions: 0 }],
        writtenParts: [{ tasks: [{ itemIds: [essay.id], key: "rule" }] }],
      },
    });
  });
});
