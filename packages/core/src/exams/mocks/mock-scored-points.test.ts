import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { SESSION_NOW } from "../../sessions/_test-utils/session-goal";
import { finishMock } from "./finish-mock";
import { getMock } from "./get-mock";
import { mockConditionsSchema } from "./mock-contract";
import { saveMockAnswer } from "./save-mock-answer";
import { startAnytimeMock } from "./start-anytime-mock";

const citation = { passage: "From the notice.", sourceId: "source" };
const UTC = "UTC";
const ITEMS_PER_AREA = 8;

const AREAS = [
  { group: "P1", name: "Mathematics" },
  { group: "P2", name: "Languages" },
] as const;

const points = (value: number) => ({ unit: "points", value });

function structure({ p2Points }: { p2Points: number }) {
  return {
    formats: [],
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: {
        description: "",
        marking: [
          { citation, format: null, part: "P1", points: 1, questions: 8, wrongPenalty: null },
          {
            citation,
            format: null,
            part: "P2",
            points: p2Points,
            questions: 8,
            wrongPenalty: null,
          },
        ],
        method: "wrongCancelsRight",
        parts: [
          {
            citation,
            maxPoints: null,
            minimum: points(4),
            name: "P1",
            qualifying: false,
            questions: 8,
          },
          {
            citation,
            maxPoints: null,
            minimum: points(4),
            name: "P2",
            qualifying: false,
            questions: 8,
          },
        ],
        totalMinimum: { citation, unit: "points", value: 10 },
        wrongPenalty: 1,
      },
      sections: [
        { day: null, kind: "objective", minutes: 24, name: "Provas objetivas", questions: 16 },
      ],
      timeLimitMinutes: 24,
      totalQuestions: 16,
    },
    rules: [],
    subjects: AREAS.map((area) => ({ citation, ...area, questions: 8, topics: [], weight: null })),
  };
}

async function setup() {
  const [user, blueprint, skills] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ structure: structure({ p2Points: 2 }) }),
    Promise.all(AREAS.map((area) => skillFixture({ name: `${area.name} ${crypto.randomUUID()}` }))),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    timezone: UTC,
    userId: user.id,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: skills.map((skill, index) => ({
        area: AREAS[index]?.name ?? "",
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
  });

  await Promise.all([
    ...skills.map((skill, position) =>
      planItemFixture({ kind: "lesson", planId: plan.id, position, skillId: skill.id }),
    ),
    ...skills.flatMap((skill) =>
      Array.from({ length: ITEMS_PER_AREA }, () =>
        itemFixture({ content: choiceItemContent(), skillId: skill.id }),
      ),
    ),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  mockSession(user.id);
  return { blueprint, goal, mathSkillId: skills[0]?.id };
}

async function readMock(id: string) {
  const result = await getMock(id);

  if (result.status !== "ready") {
    throw new Error("Expected the mock");
  }

  return result.mock;
}

describe("a mock scored in the notice's points", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the points it started with when the notice is read again mid-sitting", async () => {
    const { blueprint, goal, mathSkillId } = await setup();

    const started = await startAnytimeMock({
      goalId: goal.id,
      input: { shape: { area: null, day: null, kind: "full" } },
    });

    const id = started.status === "started" ? started.id : "";

    await prisma.examBlueprint.update({
      data: { structure: structure({ p2Points: 5 }) },
      where: { id: blueprint.id },
    });

    const running = await readMock(id);

    await Promise.all(
      (running.current?.questions ?? []).map((question) =>
        saveMockAnswer({
          blockId: id,
          input: {
            answer: { selectedIndex: question.skillId === mathSkillId ? 0 : 1 },
            durationMs: 30_000,
            flagged: false,
            itemId: question.itemId,
          },
        }),
      ),
    );

    await finishMock({ blockId: id, input: { timeZone: UTC } });

    const row = await prisma.mockExam.findUniqueOrThrow({ where: { id } });
    const marking = mockConditionsSchema.parse(row.conditions).marking;
    const finished = await readMock(id);

    expect(new Set(Object.values(marking?.items ?? {}).map((item) => item.points))).toStrictEqual(
      new Set([1, 2]),
    );

    expect(finished.result?.points).toMatchObject({
      asked: 24,
      earned: -8,
      max: 24,
      met: false,
      minimum: { unit: "points", value: 10 },
      parts: [
        { earned: 8, met: true, name: "P1" },
        { earned: -16, met: false, name: "P2", short: 20 },
      ],
      unjudged: [],
    });
  });
});
