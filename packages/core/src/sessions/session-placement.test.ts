import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { answerStudyQuestion } from "./answer-study-question";
import { getStudyBlock } from "./get-study-block";
import { getTodayStudySession } from "./get-today-study-session";
import { startStudyBlock } from "./start-study-block";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// The classifier is a paid model call; placement answers never reach it.
vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({ classifyMistakeCause: vi.fn() }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(async () => false),
}));

const TIME_ZONE = "UTC";

/** A goal made today with one skill placement is unsure of: one right pick so far. */
async function setup({ details = {} }: { details?: object } = {}) {
  const user = await userFixture();
  const fixture = await learnerGoalFixture({ itemsPerSkill: 2, phases: [1], userId: user.id });
  const [first, second] = fixture.items;

  await Promise.all([
    prisma.goal.update({
      data: { createdAt: new Date(), details, timezone: TIME_ZONE },
      where: { id: fixture.goal.id },
    }),
    attemptFixture({
      answer: { selectedIndex: 0 },
      isCorrect: true,
      itemId: first?.id ?? null,
      skillId: first?.skillId ?? null,
      userId: user.id,
    }),
  ]);

  mockSession(user.id);
  return { ...fixture, placementItemId: second?.id ?? "", user };
}

async function openPlacementBlock(goalId: string) {
  const today = await getTodayStudySession({ goalId, timeZone: TIME_ZONE });
  const session = today.status === "ready" ? today.session : null;
  const review = session?.blocks.find((block) => block.kind === "review");

  if (!session || !review) {
    throw new Error("Expected a review block with placement questions");
  }

  await startStudyBlock({ blockId: review.id, input: {}, sessionId: session.id });
  return { blockId: review.id, sessionId: session.id };
}

/** Whether the goal's session opens with a review block: placement questions (no capsules are due). */
async function hasReviewBlock({ goal, user }: { goal: { id: string }; user: { id: string } }) {
  mockSession(user.id);
  const today = await getTodayStudySession({ goalId: goal.id, timeZone: TIME_ZONE });
  const blocks = today.status === "ready" ? today.session.blocks : [];

  return blocks.some((block) => block.kind === "review");
}

describe("placement in the first week's sessions", () => {
  it("opens the session with the unsure skill's question, marked as placement", async () => {
    const { goal, placementItemId } = await setup();
    const { blockId, sessionId } = await openPlacementBlock(goal.id);

    const block = await getStudyBlock({ blockId, sessionId });
    const questions = block.status === "ready" ? block.detail.questions : [];

    expect(questions[0]).toMatchObject({ itemId: placementItemId, placement: true });
  });

  it("asks an exam that judges assertions its own true/false question before multiple choice", async () => {
    const { goal, items } = await setup();
    const skillId = items[0]?.skillId ?? "";

    const exam = await examBlueprintFixture({
      structure: {
        formats: [
          {
            citation: { passage: "Certo ou Errado.", sourceId: "notice" },
            description: "Itens julgados Certo ou Errado.",
            kind: "trueFalse",
            options: null,
          },
        ],
        mock: null,
        rules: [],
        subjects: [],
      },
    });

    const [trueFalse] = await Promise.all([
      itemFixture({
        content: {
          context: null,
          isTrue: true,
          misconception: null,
          reason: "It follows the rule.",
          statement: "The rule applies here.",
        },
        examBlueprintId: exam.id,
        format: "trueFalse",
        skillId,
      }),
      prisma.goal.update({ data: { examBlueprintId: exam.id }, where: { id: goal.id } }),
    ]);

    const { blockId, sessionId } = await openPlacementBlock(goal.id);
    const block = await getStudyBlock({ blockId, sessionId });
    const questions = block.status === "ready" ? block.detail.questions : [];

    expect(questions[0]).toMatchObject({ itemId: trueFalse.id, placement: true });
  });

  it("settles the start from a right answer and skips what the plan no longer needs", async () => {
    const { goal, placementItemId, planItems, user } = await setup();
    const { blockId, sessionId } = await openPlacementBlock(goal.id);

    const result = await answerStudyQuestion({
      blockId,
      input: {
        answer: { selectedIndex: 0 },
        durationMs: 3000,
        itemId: placementItemId,
        timeZone: TIME_ZONE,
      },
      sessionId,
    });

    expect(result).toMatchObject({ feedback: { isCorrect: true }, status: "ready" });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: planItems[0]?.id } }),
    ).resolves.toMatchObject({ status: "testedOut" });

    await expect(
      prisma.learnerSkill.findFirst({ where: { reps: { gt: 0 }, userId: user.id } }),
    ).resolves.not.toBeNull();
  });

  it("never saves a wrong placement answer as a mistake", async () => {
    const { goal, placementItemId, user } = await setup();
    const { blockId, sessionId } = await openPlacementBlock(goal.id);

    const result = await answerStudyQuestion({
      blockId,
      input: {
        answer: { dontKnow: true },
        durationMs: 3000,
        itemId: placementItemId,
        timeZone: TIME_ZONE,
      },
      sessionId,
    });

    expect(result).toMatchObject({
      feedback: { isCorrect: false, savedToNotebook: false },
      status: "ready",
    });

    await expect(prisma.mistake.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("asks nothing after the first week, or when the learner chose to start from scratch", async () => {
    const [late, declined] = await Promise.all([
      setup(),
      setup({ details: { placementDeclined: true } }),
    ]);

    await prisma.goal.update({
      data: { createdAt: new Date(Date.now() - 10 * 86_400_000) },
      where: { id: late.goal.id },
    });

    await expect(hasReviewBlock(late)).resolves.toBe(false);
    await expect(hasReviewBlock(declined)).resolves.toBe(false);
  });
});
