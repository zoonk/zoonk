import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { type SectionNavigation } from "../../library/exams/blueprint-contract";
import { getMock } from "./get-mock";
import { type MockView } from "./mock-contract";
import { saveMockAnswer } from "./save-mock-answer";
import { startAnytimeMock } from "./start-anytime-mock";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const CITATION = { passage: "From the notice.", sourceId: "source" };
const QUESTIONS = 6;

/**
 * A GMAT-like section of six questions: never back to a question once left, each one answered
 * before the next, and a review at its end that may change two answers.
 */
const GMAT_LIKE: SectionNavigation = {
  answerChanges: 2,
  forwardOnly: true,
  itemSeconds: null,
  mustAnswer: true,
};

async function navigationSetup(navigation: SectionNavigation) {
  const [user, blueprint, skill] = await Promise.all([
    userFixture(),
    examBlueprintFixture({
      structure: {
        formats: [],
        mock: {
          adaptive: false,
          citations: [],
          order: null,
          scoring: { description: "", method: "raw" },
          sections: [
            {
              day: null,
              kind: "objective",
              minutes: 12,
              name: "Quantitative Reasoning",
              navigation,
              questions: QUESTIONS,
            },
          ],
          timeLimitMinutes: 12,
          totalQuestions: QUESTIONS,
        },
        rules: [],
        subjects: [
          {
            citation: CITATION,
            name: "Quantitative Reasoning",
            questions: QUESTIONS,
            topics: [],
            weight: null,
          },
        ],
      },
    }),
    skillFixture({ name: `Quantitative Reasoning ${crypto.randomUUID()}` }),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    timezone: "UTC",
    userId: user.id,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: [
        {
          area: "Quantitative Reasoning",
          lessons: 1,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        },
      ],
    },
  });

  await Promise.all([
    planItemFixture({ kind: "lesson", planId: plan.id, position: 0, skillId: skill.id }),
    ...Array.from({ length: QUESTIONS }, () =>
      itemFixture({
        content: choiceItemContent(),
        examBlueprintId: blueprint.id,
        skillId: skill.id,
      }),
    ),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  mockSession(user.id);

  const started = await startAnytimeMock({
    goalId: goal.id,
    input: { shape: { area: null, day: null, kind: "full" }, timeZone: "UTC" },
  });

  if (started.status !== "started") {
    throw new Error(`Expected a started mock, got ${started.status}`);
  }

  const mock = await readMock(started.id);
  return { id: started.id, itemIds: (mock.current?.questions ?? []).map((item) => item.itemId) };
}

async function readMock(id: string): Promise<MockView> {
  const result = await getMock(id);

  if (result.status !== "ready") {
    throw new Error("Expected the mock");
  }

  return result.mock;
}

function pick({ id, index, itemId }: { id: string; index: number; itemId: string }) {
  return saveMockAnswer({
    blockId: id,
    input: { answer: { selectedIndex: index }, durationMs: 5000, flagged: false, itemId },
  });
}

describe("a mock section that moves like the real exam's", () => {
  it("never goes back to a question once left, and its end review changes only so many answers", async () => {
    const { id, itemIds } = await navigationSetup(GMAT_LIKE);
    const [first, second, third, fourth] = itemIds;

    const started = await readMock(id);

    expect(started.sections[0]?.navigation).toStrictEqual(GMAT_LIKE);

    await pick({ id, index: 0, itemId: first ?? "" });
    await pick({ id, index: 0, itemId: second ?? "" });

    // The question on screen may still change; one left behind can't.
    await expect(pick({ id, index: 1, itemId: second ?? "" })).resolves.toStrictEqual({
      status: "saved",
    });

    await expect(pick({ id, index: 1, itemId: first ?? "" })).resolves.toStrictEqual({
      status: "locked",
    });

    // Its time and flag still save with the same answer.
    await expect(
      saveMockAnswer({
        blockId: id,
        input: {
          answer: { selectedIndex: 0 },
          durationMs: 9000,
          flagged: true,
          itemId: first ?? "",
        },
      }),
    ).resolves.toStrictEqual({ status: "saved" });

    // A reload opens where the learner got to.
    const reloaded = await readMock(id);

    expect(reloaded.current).toMatchObject({ changesLeft: 2, resume: 1 });

    for (const itemId of itemIds.slice(2)) {
      // oxlint-disable-next-line no-await-in-loop -- One question after another, in order.
      await pick({ id, index: 0, itemId });
    }

    // At the end, the review changes two answers, and no more.
    await expect(pick({ id, index: 1, itemId: first ?? "" })).resolves.toStrictEqual({
      status: "saved",
    });

    await expect(pick({ id, index: 1, itemId: third ?? "" })).resolves.toStrictEqual({
      status: "saved",
    });

    // An answer changed already changes again without using another change.
    await expect(pick({ id, index: 0, itemId: first ?? "" })).resolves.toStrictEqual({
      status: "saved",
    });

    await expect(pick({ id, index: 1, itemId: fourth ?? "" })).resolves.toStrictEqual({
      status: "locked",
    });

    const reviewed = await readMock(id);

    expect(reviewed.current).toMatchObject({ changesLeft: 0, resume: QUESTIONS - 1 });
  });

  it("keeps a section that moves freely as it was: any answer changes, and it opens again past the last answer", async () => {
    const { id, itemIds } = await navigationSetup({
      answerChanges: null,
      forwardOnly: false,
      itemSeconds: 90,
      mustAnswer: false,
    });

    const [first, second] = itemIds;

    await pick({ id, index: 0, itemId: first ?? "" });
    await pick({ id, index: 0, itemId: second ?? "" });

    await expect(pick({ id, index: 1, itemId: first ?? "" })).resolves.toStrictEqual({
      status: "saved",
    });

    const free = await readMock(id);

    expect(free.current).toMatchObject({ changesLeft: null, resume: 2 });
  });
});
