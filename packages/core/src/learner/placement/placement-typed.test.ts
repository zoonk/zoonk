import { gradeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/grade-typed-answer";
import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getUsageRule } from "../../entitlements/limits";
import { examStructure } from "../../library/exams/_test-utils/exam-formats";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { answerPlacementQuestion } from "./answer-placement-question";
import { getGoalPlacement } from "./get-goal-placement";

const KEY_POINTS = ["Names the shared denominator", "Adds the numerators"];

const TYPED_CONTENT = {
  acceptedAnswers: ["5/6"],
  context: null,
  keyPoints: KEY_POINTS,
  question: "How do you add 1/2 and 1/3?",
  sampleAnswer: "Use sixths: 3/6 + 2/6 = 5/6.",
};

/**
 * The real grader settles accepted answers by code, as in production; an answer that needs its
 * model gets this verdict once.
 */
function mockGrade({ met }: { met: number }) {
  vi.mocked(gradeTypedAnswer).mockResolvedValueOnce({
    data: {
      corrections: [],
      feedback: "You found the denominator but didn't add the numerators.",
      isCorrect: met === KEY_POINTS.length,
      keyPoints: KEY_POINTS.map((text, index) => ({ met: index < met, text })),
      method: "model",
      score: met / KEY_POINTS.length,
      spelling: null,
    },
    provenance: null,
    systemPrompt: "",
    usage: null,
    userPrompt: "",
  });
}

/**
 * One skill with two quick questions and a typed one. A language goal confirms a right pick in
 * writing; every other goal, an exam that asks short written answers too, with the other pick.
 */
async function setup({ goal = "language" }: { goal?: "hobby" | "language" | "shortAnswers" } = {}) {
  const user = await userFixture();

  const [fixture, blueprint] = await Promise.all([
    learnerGoalFixture({ itemsPerSkill: 1, phases: [1], userId: user.id }),
    examBlueprintFixture({ structure: examStructure(["multipleChoice", "shortAnswer"]) }),
  ]);

  const skillId = fixture.skills[0]?.id ?? "";

  const [typed] = await Promise.all([
    itemFixture({ content: TYPED_CONTENT, format: "typed", skillId }),
    itemFixture({ content: choiceItemContent(), skillId }),
    // Its run wrote placement's questions, so placement asks the general ones in the bank.
    prisma.plan.update({
      data: { placementPreparedAt: new Date() },
      where: { id: fixture.plan.id },
    }),
    goal === "hobby"
      ? null
      : prisma.goal.update({
          data:
            goal === "language"
              ? { kind: "language", targetLanguage: "en" }
              : { examBlueprintId: blueprint.id, kind: "exam" },
          where: { id: fixture.goal.id },
        }),
  ]);

  mockSession(user.id);
  return { ...fixture, typed, user };
}

async function answerQuickRight({ goalId }: { goalId: string }) {
  const first = await getGoalPlacement({ goalId });
  const itemId = first.status === "ready" ? (first.placement.next?.itemId ?? "") : "";

  expect(first.status === "ready" && first.placement.next?.format).toBe("multipleChoice");

  return answerPlacementQuestion({
    goalId,
    input: { answer: { selectedIndex: 0 }, durationMs: 4000, itemId },
  });
}

describe("typed answers in placement", () => {
  beforeEach(() => {
    vi.mocked(gradeTypedAnswer).mockClear();
  });

  it("confirms a right pick with a typed question, without its key points or answers", async () => {
    const { goal, typed } = await setup();
    const afterPick = await answerQuickRight({ goalId: goal.id });

    expect(afterPick).toMatchObject({
      isCorrect: true,
      placement: { complete: false, next: { format: "typed", itemId: typed.id, options: null } },
      status: "ready",
    });

    expect(JSON.stringify(afterPick)).not.toContain("5/6");
    expect(JSON.stringify(afterPick)).not.toContain("shared denominator");

    // An accepted answer is settled by code, and it settles the skill.
    const confirmed = await answerPlacementQuestion({
      goalId: goal.id,
      input: { answer: { text: " 5/6 " }, durationMs: 9000, itemId: typed.id },
    });

    expect(confirmed).toMatchObject({ isCorrect: true, placement: { complete: true } });
    expect(vi.mocked(gradeTypedAnswer)).toHaveBeenCalledOnce();
  });

  it("grades a typed answer with the model past the learner's small AI help, without counting it", async () => {
    const { goal, typed, user } = await setup();
    await answerQuickRight({ goalId: goal.id });
    const capped = getUsageRule({ kind: "assist", tier: "free" }).day ?? 0;

    await usageRecordsFixture({
      count: capped,
      createdAt: new Date(),
      kind: "assist",
      userId: user.id,
    });

    mockGrade({ met: KEY_POINTS.length });

    await expect(
      answerPlacementQuestion({
        goalId: goal.id,
        input: {
          answer: { text: "Use sixths as the shared bottom, then add the tops" },
          durationMs: 9000,
          itemId: typed.id,
        },
      }),
    ).resolves.toMatchObject({ isCorrect: true, status: "ready" });

    expect(gradeTypedAnswer).toHaveBeenCalledOnce();

    await expect(
      prisma.usageRecord.count({ where: { kind: "assist", userId: user.id } }),
    ).resolves.toBe(capped);
  });

  it("grades by code alone past a few answers to one question a day, where only accepted answers count", async () => {
    const { goal, typed, user } = await setup();
    await answerQuickRight({ goalId: goal.id });

    await Promise.all(
      Array.from({ length: 5 }, () => attemptFixture({ itemId: typed.id, userId: user.id })),
    );

    const [paraphrase, accepted] = await Promise.all([
      answerPlacementQuestion({
        goalId: goal.id,
        input: { answer: { text: "Make the bottoms equal" }, durationMs: 9000, itemId: typed.id },
      }),
      answerPlacementQuestion({
        goalId: goal.id,
        input: { answer: { text: "5/6" }, durationMs: 9000, itemId: typed.id },
      }),
    ]);

    expect(
      [paraphrase, accepted].map((result) => result.status === "ready" && result.isCorrect),
    ).toStrictEqual([false, true]);

    expect(gradeTypedAnswer).not.toHaveBeenCalled();
  });

  it("counts an answer that misses a key point as wrong, so a lucky pick can't skip it", async () => {
    const { goal, skills, typed, user } = await setup();
    await answerQuickRight({ goalId: goal.id });

    mockGrade({ met: 1 });

    const result = await answerPlacementQuestion({
      goalId: goal.id,
      input: { answer: { text: "Make the bottoms equal" }, durationMs: 9000, itemId: typed.id },
    });

    expect(result).toMatchObject({ isCorrect: false, status: "ready" });
    expect(result.status === "ready" && result.placement.knownSkillIds).toStrictEqual([]);

    const attempt = await prisma.attempt.findFirstOrThrow({
      where: { itemId: typed.id, userId: user.id },
    });

    expect(attempt).toMatchObject({ answer: { text: "Make the bottoms equal" }, isCorrect: false });

    // A diagnostic answer never fills the mistakes notebook.
    await expect(
      prisma.mistake.count({ where: { skillId: skills[0]?.id, userId: user.id } }),
    ).resolves.toBe(0);
  });

  /*
   * A hobby biology course asked the learner to write what Iara's cell diagram was missing:
   * learners would rather pick, so a goal whose exam asks no written answers never gets a typed
   * question, even one the shared bank has.
   */
  it("confirms a right pick with another quick question for every goal but a language's", async () => {
    // Each setup signs its own learner in, so the two answer one after the other.
    const hobby = await setup({ goal: "hobby" });
    const hobbyPick = await answerQuickRight({ goalId: hobby.goal.id });
    const shortAnswers = await setup({ goal: "shortAnswers" });
    const shortAnswersPick = await answerQuickRight({ goalId: shortAnswers.goal.id });

    expect([hobbyPick, shortAnswersPick]).toMatchObject([
      { placement: { complete: false, next: { format: "multipleChoice" } }, status: "ready" },
      { placement: { complete: false, next: { format: "multipleChoice" } }, status: "ready" },
    ]);

    // The second right pick makes placement as sure of the skill as a right typed answer did.
    mockSession(hobby.user.id);

    const confirmed = await answerPlacementQuestion({
      goalId: hobby.goal.id,
      input: {
        answer: { selectedIndex: 0 },
        durationMs: 4000,
        itemId: hobbyPick.status === "ready" ? (hobbyPick.placement.next?.itemId ?? "") : "",
      },
    });

    expect(confirmed).toMatchObject({
      isCorrect: true,
      placement: { complete: true, knownSkillIds: [hobby.skills[0]?.id] },
    });
  });

  it("rejects a typed answer to a choice question and a pick for a typed one", async () => {
    const { goal, items, typed } = await setup();

    const [textForChoice, pickForTyped] = await Promise.all([
      answerPlacementQuestion({
        goalId: goal.id,
        input: { answer: { text: "Right answer" }, durationMs: 1000, itemId: items[0]?.id ?? "" },
      }),
      answerPlacementQuestion({
        goalId: goal.id,
        input: { answer: { selectedIndex: 0 }, durationMs: 1000, itemId: typed.id },
      }),
    ]);

    expect([textForChoice.status, pickForTyped.status]).toStrictEqual([
      "invalidItem",
      "invalidItem",
    ]);
  });
});
