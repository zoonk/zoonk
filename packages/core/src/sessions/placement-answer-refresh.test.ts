import { prisma } from "@zoonk/db";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { after } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { refreshGoalPlan } from "../plans/refresh-goal-plan";
import { getTodayStudySession } from "./_test-utils/open-today";
import { answerStudyQuestion } from "./answer-study-question";
import { readBlockPayload } from "./block-payload";
import { startStudyBlock } from "./start-study-block";
import type * as Refresh from "../plans/refresh-goal-plan";

vi.mock("../plans/refresh-goal-plan", async (importOriginal) => {
  const original = await importOriginal<typeof Refresh>();
  return { ...original, refreshGoalPlan: vi.fn(original.refreshGoalPlan) };
});

const TIME_ZONE = "UTC";
const DAY_MS = 86_400_000;

const TRUE_STATEMENT = {
  context: null,
  isTrue: true,
  misconception: "Reads the rule backwards",
  reason: "The rule holds here.",
  statement: "The rule holds here.",
};

async function setup(format: "multipleChoice" | "trueFalse") {
  const user = await userFixture();
  const library = await planLibraryFixture({ skills: [{ lessons: 2 }, { lessons: 2 }] });

  const { goal } = await unplannedGoalFixture({
    createdAt: new Date(Date.now() - DAY_MS),
    timezone: TIME_ZONE,
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  await Promise.all(
    library.skills.map((skill) =>
      Promise.all(
        [0, 1].map(() =>
          itemFixture(
            format === "trueFalse"
              ? { content: TRUE_STATEMENT, format, skillId: skill.id }
              : { content: choiceItemContent(), skillId: skill.id },
          ),
        ),
      ),
    ),
  );

  mockSession(user.id);

  const today = await getTodayStudySession({ goalId: goal.id, timeZone: TIME_ZONE });
  const session = today.status === "ready" ? today.session : null;
  const review = session?.blocks.find((block) => block.kind === "review");

  if (!session || !review) {
    throw new Error("Expected a review block with placement questions");
  }

  await startStudyBlock({ blockId: review.id, input: {}, sessionId: session.id });

  const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: review.id } });
  const [itemId] = readBlockPayload(block).placementItemIds ?? [];

  return { blockId: review.id, goal, itemId: itemId ?? "", sessionId: session.id };
}

async function runAfterResponse() {
  const tasks = vi.mocked(after).mock.calls.map(([task]) => task);
  vi.mocked(after).mockClear();
  await Promise.all(tasks.map((task) => (typeof task === "function" ? task() : task)));
}

const replans = () =>
  vi.mocked(refreshGoalPlan).mock.calls.filter(([input]) => input.pace === "saved");

describe("a placement answer in a first-week session", () => {
  beforeEach(() => {
    vi.mocked(after).mockClear();
    vi.mocked(refreshGoalPlan).mockClear();
  });

  it("plans again after the response when it changes what the plan reads of its skill", async () => {
    const { blockId, itemId, sessionId } = await setup("multipleChoice");

    await answerStudyQuestion({
      blockId,
      input: { answer: { selectedIndex: 1 }, durationMs: 3000, itemId, timeZone: TIME_ZONE },
      sessionId,
    });

    expect(replans()).toHaveLength(0);

    await runAfterResponse();

    expect(replans()).toHaveLength(1);
  });

  it("leaves the plan as it is when it tells the plan nothing new", async () => {
    const { blockId, itemId, sessionId } = await setup("trueFalse");

    const result = await answerStudyQuestion({
      blockId,
      input: { answer: { isTrue: true }, durationMs: 3000, itemId, timeZone: TIME_ZONE },
      sessionId,
    });

    await runAfterResponse();

    expect(result).toMatchObject({ feedback: { isCorrect: true }, status: "ready" });
    expect(replans()).toHaveLength(0);
  });
});
