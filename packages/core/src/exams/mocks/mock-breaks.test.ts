import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { pickItemInMock } from "../../_test-utils/shown-choice";
import { getItemAudienceFilter } from "../../library/items/item-field";
import { SESSION_NOW } from "../../sessions/_test-utils/session-goal";
import { endMockBreak } from "./end-mock-break";
import { finishMock } from "./finish-mock";
import { getMock } from "./get-mock";
import { type MockView, mockConditionsSchema } from "./mock-contract";
import { saveMockAnswer } from "./save-mock-answer";
import { startAnytimeMock } from "./start-anytime-mock";
import { submitMockSection } from "./submit-mock-section";

const CITATION = { passage: "From the notice.", sourceId: "source" };
const UTC = "UTC";
const MINUTE_MS = 60_000;
const AREAS = ["Physics", "Mathematics"] as const;

const STRUCTURE = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: {
      description: "+4 for a right answer, -1 for a wrong one",
      method: "wrongCancelsRight",
      wrongPenalty: 0.25,
    },
    sections: [
      {
        breakAfterMinutes: 10,
        day: null,
        kind: "objective",
        minutes: 12,
        name: "Physics",
        questions: 6,
        tools: "No calculator.",
      },
      {
        day: null,
        kind: "objective",
        minutes: 12,
        name: "Mathematics",
        questions: 6,
        tools: "No calculator. A formula sheet is given.",
      },
    ],
    timeLimitMinutes: 24,
    totalQuestions: 12,
  },
  rules: [],
  subjects: AREAS.map((name) => ({
    citation: CITATION,
    name,
    questions: 6,
    topics: [],
    weight: null,
  })),
};

async function breakSetup() {
  const [user, blueprint, skills] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ structure: STRUCTURE }),
    Promise.all(AREAS.map((area) => skillFixture({ name: `${area} ${crypto.randomUUID()}` }))),
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
        area: AREAS[index] ?? "",
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
      Array.from({ length: 6 }, () =>
        itemFixture({
          content: choiceItemContent(),
          examBlueprintId: blueprint.id,
          mockOnly: true,
          skillId: skill.id,
        }),
      ),
    ),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  mockSession(user.id);

  const started = await startAnytimeMock({
    goalId: goal.id,
    input: { shape: { area: null, day: null, kind: "full" } },
  });

  if (started.status !== "started") {
    throw new Error(`Expected a started mock, got ${started.status}`);
  }

  return { id: started.id, userId: user.id };
}

async function readMock(id: string): Promise<MockView> {
  const result = await getMock(id);

  if (result.status !== "ready") {
    throw new Error("Expected the mock");
  }

  return result.mock;
}

async function answer({ id, right }: { id: string; right: number }) {
  const running = await readMock(id);

  await Promise.all(
    (running.current?.questions ?? []).map(async (question, index) =>
      saveMockAnswer({
        blockId: id,
        input: {
          answer: await pickItemInMock({
            itemId: question.itemId,
            mockId: id,
            right: right < 0 ? index > 0 : index < right,
          }),
          durationMs: 30_000,
          flagged: false,
          itemId: question.itemId,
        },
      }),
    ),
  );
}

describe("a mock with the notice's breaks, tools and penalty", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says each section's tools, then gives the real break before the next section's clock", async () => {
    const { id } = await breakSetup();
    const started = await readMock(id);

    expect(
      started.sections.map(({ breakAfterMinutes, tools }) => ({ breakAfterMinutes, tools })),
    ).toStrictEqual([
      { breakAfterMinutes: 10, tools: "No calculator." },
      { breakAfterMinutes: null, tools: "No calculator. A formula sheet is given." },
    ]);

    await answer({ id, right: 4 });
    await submitMockSection({ blockId: id, input: { timeZone: UTC }, section: 0 });

    const onBreak = await readMock(id);

    expect(onBreak).toMatchObject({
      breakUntil: new Date(SESSION_NOW.getTime() + 10 * MINUTE_MS).toISOString(),
      current: null,
      status: "running",
    });

    const sitting = await prisma.mockExam.findUniqueOrThrow({ where: { id } });
    const conditions = sitting.conditions as { sections: { itemIds: string[] }[] };

    await expect(
      saveMockAnswer({
        blockId: id,
        input: {
          answer: { selectedIndex: 0 },
          durationMs: 1000,
          flagged: false,
          itemId: conditions.sections[1]?.itemIds[0] ?? "",
        },
      }),
    ).resolves.toStrictEqual({ status: "notRunning" });

    vi.setSystemTime(SESSION_NOW.getTime() + 3 * MINUTE_MS);

    await expect(endMockBreak({ blockId: id })).resolves.toStrictEqual({ status: "started" });

    const next = await readMock(id);
    const minutes = next.sections[1]?.minutes ?? 0;

    expect(next).toMatchObject({ breakUntil: null });

    expect(next.current?.deadline).toBe(
      new Date(SESSION_NOW.getTime() + (3 + minutes) * MINUTE_MS).toISOString(),
    );

    await expect(endMockBreak({ blockId: id })).resolves.toStrictEqual({ status: "notOnBreak" });
  });

  it("spends unopened questions when the finished review shows their keys", async () => {
    const { id } = await breakSetup();
    await submitMockSection({ blockId: id, input: { timeZone: UTC }, section: 0 });
    await finishMock({ blockId: id, input: { timeZone: UTC } });

    await expect(
      prisma.mockItemUse.count({
        where: { mockExamId: id, section: 1, spentAt: { lte: SESSION_NOW } },
      }),
    ).resolves.toBe(6);

    await expect(prisma.mockItemUse.count({ where: { mockExamId: id, section: 0 } })).resolves.toBe(
      6,
    );
  });

  it("admits only questions from the paper the learner finished to practice", async () => {
    const { id, userId } = await breakSetup();
    const mock = await prisma.mockExam.findUniqueOrThrow({ where: { id } });
    const conditions = mockConditionsSchema.parse(mock.conditions);
    const [opening, second] = conditions.sections;
    const first = opening?.itemIds[0];
    const chosen = second?.itemIds[0];

    if (!opening || !second || !first || !chosen) {
      throw new Error("Expected two mock sections with questions");
    }

    const chosenItem = await prisma.item.findUniqueOrThrow({ where: { id: chosen } });

    const alternative = await itemFixture({
      content: choiceItemContent(),
      examBlueprintId: mock.examBlueprintId,
      mockOnly: true,
      skillId: chosenItem.skillId,
    });

    await prisma.mockExam.update({
      data: {
        conditions: {
          ...conditions,
          sections: [
            opening,
            {
              ...second,
              itemIds: [],
              routing: { easier: second.itemIds, harder: [alternative.id] },
            },
          ],
        },
      },
      where: { id },
    });

    await prisma.mockItemUse.create({
      data: { itemId: alternative.id, mockExamId: id, section: 1, userId },
    });

    const practiceItems = () =>
      prisma.item.findMany({
        orderBy: { id: "asc" },
        select: { id: true },
        where: {
          ...getItemAudienceFilter({ examBlueprintId: mock.examBlueprintId, userId }),
          id: { in: [first, chosen, alternative.id] },
        },
      });

    await expect.soft(practiceItems()).resolves.toStrictEqual([]);
    await submitMockSection({ blockId: id, input: { timeZone: UTC }, section: 0 });
    await endMockBreak({ blockId: id });
    await finishMock({ blockId: id, input: { timeZone: UTC } });

    await expect(practiceItems()).resolves.toStrictEqual(
      [first, chosen].toSorted().map((itemId) => ({ id: itemId })),
    );

    await expect(
      prisma.mockItemUse.findFirst({ where: { itemId: alternative.id, userId } }),
    ).resolves.toMatchObject({ spentAt: expect.any(Date) });
  });

  it("starts the next section by itself when the break runs out", async () => {
    const { id } = await breakSetup();

    await submitMockSection({ blockId: id, input: { timeZone: UTC }, section: 0 });
    vi.setSystemTime(SESSION_NOW.getTime() + 11 * MINUTE_MS);

    const next = await readMock(id);

    expect(next).toMatchObject({ breakUntil: null });
    expect(next.current?.questions).toHaveLength(next.sections[1]?.questions ?? -1);
  });

  it("takes a quarter point for each wrong answer, as the notice's +4 and -1 do", async () => {
    const { id } = await breakSetup();

    await answer({ id, right: -1 });
    await submitMockSection({ blockId: id, input: { timeZone: UTC }, section: 0 });
    await endMockBreak({ blockId: id });
    await answer({ id, right: -1 });
    await finishMock({ blockId: id, input: { timeZone: UTC } });

    const { result } = await readMock(id);
    const right = result?.net?.right ?? 0;

    expect(result).toMatchObject({ net: { penalty: 0.25, wrong: 2 }, scoring: "net" });
    expect(result?.net?.net).toBe(right - 0.5);
  });
});
