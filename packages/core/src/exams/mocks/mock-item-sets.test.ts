import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  choiceItemContent,
  itemFixture,
  itemSetFixture,
  skillFixture,
} from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getMock } from "./get-mock";
import { type MockView } from "./mock-contract";
import { startAnytimeMock } from "./start-anytime-mock";
import { submitMockSection } from "./submit-mock-section";

vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({ classifyMistakeCause: vi.fn() }));

const CITATION = { passage: "From the notice.", sourceId: "source" };
const SUBJECT = "Reading";
const QUESTIONS = 6;
const SINGLES = 4;
const PASSAGE = "The town's library opened on Sundays last year. Visits rose by a third.";

/**
 * An exam whose one section asks six questions, and a bank with a text three questions read
 * beside four questions on their own: the mock has room for the text and three of the others.
 */
async function setsSetup() {
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
            { day: null, kind: "objective", minutes: 12, name: SUBJECT, questions: QUESTIONS },
          ],
          timeLimitMinutes: 12,
          totalQuestions: QUESTIONS,
        },
        rules: [],
        subjects: [
          { citation: CITATION, name: SUBJECT, questions: QUESTIONS, topics: [], weight: null },
        ],
      },
    }),
    skillFixture({ name: `${SUBJECT} ${crypto.randomUUID()}` }),
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
        { area: SUBJECT, lessons: 1, name: skill.name, phase: 0, skillId: skill.id, weight: null },
      ],
    },
  });

  const set = await itemSetFixture({
    content: { source: "A town paper.", text: PASSAGE, title: "Sunday openings" },
    examBlueprintId: blueprint.id,
  });

  const inSet = await Promise.all(
    [0, 1, 2].map((setPosition) =>
      itemFixture({
        content: choiceItemContent(`On the text, question ${setPosition + 1}?`),
        examBlueprintId: blueprint.id,
        setId: set.id,
        setPosition,
        skillId: skill.id,
      }),
    ),
  );

  await Promise.all([
    planItemFixture({ kind: "lesson", planId: plan.id, position: 0, skillId: skill.id }),
    ...Array.from({ length: SINGLES }, () =>
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

  return { id: started.id, setId: set.id, setItemIds: inSet.map((item) => item.id) };
}

async function readMock(id: string): Promise<MockView> {
  const result = await getMock(id);

  if (result.status !== "ready") {
    throw new Error("Expected the mock");
  }

  return result.mock;
}

describe("a mock with questions that share a text", () => {
  it("asks the set whole, its questions together in order with the text, and shows the text in the review", async () => {
    const { id, setId, setItemIds } = await setsSetup();
    const started = await readMock(id);
    const questions = started.current?.questions ?? [];
    const first = questions.findIndex((question) => question.set?.id === setId);

    expect(questions).toHaveLength(QUESTIONS);

    expect(questions.slice(first, first + 3).map((question) => question.itemId)).toStrictEqual(
      setItemIds,
    );

    expect(questions[first]?.set).toMatchObject({
      count: 3,
      kind: "text",
      position: 0,
      text: PASSAGE,
      title: "Sunday openings",
    });

    expect(questions[first + 2]?.set).toMatchObject({ position: 2 });

    // Left blank, every question comes back in the review with its text.
    await submitMockSection({ blockId: id, input: { timeZone: "UTC" }, section: 0 });
    const finished = await readMock(id);
    const reviewed = finished.review.find((entry) => entry.itemId === setItemIds[1]);

    expect(reviewed).toMatchObject({ outcome: "blank", set: { id: setId, position: 1 } });
  });
});
