import { prisma } from "@zoonk/db";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { choiceItemContent } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { examTestGoalFixture, startSitting } from "../learner/_test-utils/exam-test-goal";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { placementItemBank } from "../learner/_test-utils/placement-tap-items";
import { gradeChoiceAnswer, parseChoiceItem } from "../learner/_utils/choice-items";
import { answerPlacementQuestion } from "../learner/placement/answer-placement-question";
import { getChapterTestOut } from "../learner/test-out/get-chapter-test-out";
import { submitChapterTestOut } from "../learner/test-out/submit-chapter-test-out";

async function picturedMistake({ itemId, userId }: { itemId: string; userId: string }) {
  const asset = await mediaAssetFixture();

  const content = {
    ...choiceItemContent(),
    image: { alt: "The original diagram", prompt: "The original diagram" },
  };

  const row = await prisma.item.update({
    data: { content, mediaAssetId: asset.id },
    include: { mediaAsset: true },
    where: { id: itemId },
  });

  const item = parseChoiceItem(row);

  if (!item) {
    throw new Error("Expected the original choice question");
  }

  const grade = gradeChoiceAnswer({ answer: { selectedIndex: 1 }, item });

  const mistake = await mistakeFixture({
    createdAt: new Date(Date.now() - 86_400_000),
    itemId: item.id,
    skillId: item.skillId,
    snapshot: grade.snapshot,
    userId,
  });

  return { asset, mistake };
}

async function expectFixed({ id, userId }: { id: string; userId: string }) {
  await expect(prisma.mistake.findUnique({ where: { id } })).resolves.toMatchObject({
    status: "fixed",
  });

  await expect(prisma.mistake.count({ where: { userId } })).resolves.toBe(1);
}

describe("diagnostic recall of notebook originals", () => {
  it("fixes the original pictured question after a correct chapter test answer on a later day", async () => {
    const user = await userFixture();

    const { chapters, goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [1],
      userId: user.id,
    });

    const [bank] = await placementItemBank([skills[0]!.id]);
    const itemId = bank![0]!.item.id;
    const { asset, mistake } = await picturedMistake({ itemId, userId: user.id });
    const answers = new Map(bank!.map(({ answer, item }) => [item.id, answer]));

    mockSession(user.id);
    const scope = { chapterId: chapters[0]!.id, goalId: goal.id };
    const read = await getChapterTestOut(scope);

    if (read.status !== "ready") {
      throw new Error(`Expected a ready chapter test, got ${read.status}`);
    }

    const { questions } = read.testOut;
    expect(questions.find((question) => question.itemId === itemId)?.image?.url).toBe(asset.url);

    await expect(
      submitChapterTestOut({
        ...scope,
        input: {
          answers: questions.map((question) => ({
            answer: answers.get(question.itemId)!,
            durationMs: 5000,
            itemId: question.itemId,
          })),
          requestId: crypto.randomUUID(),
        },
      }),
    ).resolves.toMatchObject({ outcome: { passed: true }, status: "ready" });

    await expectFixed(mistake);
  });

  it("fixes the original pictured question after a correct focus test answer on a later day", async () => {
    const { goal, items, user } = await examTestGoalFixture({
      subjects: [{ items: 1, name: "Math", questions: 10 }],
    });

    const itemId = items[0]!.id;
    const { asset, mistake } = await picturedMistake({ itemId, userId: user.id });
    const { next } = await startSitting(goal.id);
    expect(next).toMatchObject({ image: { url: asset.url }, itemId });

    await expect(
      answerPlacementQuestion({
        goalId: goal.id,
        input: { answer: { selectedIndex: 0 }, durationMs: 5000, itemId },
      }),
    ).resolves.toMatchObject({ isCorrect: true, status: "ready" });

    await expectFixed(mistake);
  });
});
