import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { buildItemContextSnapshot } from "./_utils/item-context-snapshot";
import { claimLessonQuestionAnswer } from "./answer-lifecycle";
import { createLessonQuestion } from "./create-lesson-question";
import { getLessonQuestion } from "./get-lesson-question";
import { getLessonQuestionThread } from "./get-lesson-question-thread";

async function learner(isAnonymous = false) {
  const user = await userFixture();

  if (isAnonymous) {
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });
  }

  await learnerGoalFixture({ itemsPerSkill: 0, phases: [1], userId: user.id });
  return user;
}

function ask(itemId: string, blockId?: string) {
  return createLessonQuestion({
    input: {
      context: { answered: false, blockId, kind: "item" },
      question: "Can you explain this question?",
      requestId: randomUUID(),
    },
    target: { itemId, kind: "item" },
  });
}

async function questionBlock({ itemId, userId }: { itemId: string; userId: string }) {
  const session = await studySessionFixture({ userId });

  return studySessionBlockFixture({
    kind: "review",
    payload: { itemIds: [itemId] },
    sessionId: session.id,
  });
}

describe("item tutor access", () => {
  it("lets the owner ask about their private skill's practice question", async () => {
    const user = await learner();
    const skill = await skillFixture({ ownerId: user.id, visibility: "private" });
    const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });
    await mistakeFixture({ itemId: item.id, skillId: skill.id, userId: user.id });
    mockSession(user.id);

    await expect(ask(item.id)).resolves.toMatchObject({ status: "created" });

    await expect(
      getLessonQuestionThread({ target: { itemId: item.id, kind: "item" } }),
    ).resolves.toMatchObject({ status: "ready", thread: { questions: [{}] } });

    await expect(
      buildItemContextSnapshot({
        context: { answered: false, kind: "item" },
        itemId: item.id,
        userId: user.id,
      }),
    ).resolves.toMatchObject({ answer: null, skill: skill.name });
  });

  it.each(["other learner", "guest"])(
    "hides private items from a %s, even with their own practice records and block",
    async (role) => {
      const [owner, caller] = await Promise.all([userFixture(), learner(role === "guest")]);
      const skill = await skillFixture({ ownerId: owner.id, visibility: "private" });
      const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

      const [block] = await Promise.all([
        questionBlock({ itemId: item.id, userId: caller.id }),
        mistakeFixture({ itemId: item.id, skillId: skill.id, userId: caller.id }),
        attemptFixture({ itemId: item.id, userId: caller.id }),
      ]);

      if (role === "guest") {
        mockGuestSession(caller.id);
      } else {
        mockSession(caller.id);
      }

      await expect(ask(item.id)).resolves.toStrictEqual({ status: "notFound" });
      await expect(ask(item.id, block.id)).resolves.toStrictEqual({ status: "notFound" });

      await expect(
        getLessonQuestionThread({ target: { itemId: item.id, kind: "item" } }),
      ).resolves.toStrictEqual({ status: "notFound" });

      const snapshots = await Promise.all(
        [undefined, block.id].map((blockId) =>
          buildItemContextSnapshot({
            context: { answered: false, blockId, kind: "item" },
            itemId: item.id,
            userId: caller.id,
          }),
        ),
      );

      expect(snapshots).toStrictEqual([null, null]);

      await expect(
        prisma.lessonQuestionThread.count({ where: { itemId: item.id, userId: caller.id } }),
      ).resolves.toBe(0);
    },
  );

  it("requires the caller's own practice evidence without a block, including for guests", async () => {
    const [caller, other] = await Promise.all([learner(true), userFixture()]);
    const skill = await skillFixture();
    const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

    await Promise.all([
      mistakeFixture({ itemId: item.id, skillId: skill.id, userId: other.id }),
      attemptFixture({ itemId: item.id, userId: other.id }),
    ]);

    mockGuestSession(caller.id);

    await expect(ask(item.id)).resolves.toStrictEqual({ status: "invalidContext" });

    await expect(
      buildItemContextSnapshot({
        context: { answered: false, kind: "item" },
        itemId: item.id,
        userId: caller.id,
      }),
    ).resolves.toBeNull();
  });

  it("allows unseen follow-up questions on a saved mistake's skill, even after it is fixed", async () => {
    const user = await learner();
    const skill = await skillFixture();

    const [original, followUp] = await Promise.all([
      itemFixture({ content: choiceItemContent(), skillId: skill.id }),
      itemFixture({ content: choiceItemContent(), skillId: skill.id }),
    ]);

    await mistakeFixture({
      itemId: original.id,
      skillId: skill.id,
      status: "fixed",
      userId: user.id,
    });

    mockSession(user.id);

    await expect(ask(followUp.id)).resolves.toMatchObject({ status: "created" });
  });

  it("allows an owned session question before any answer or mistake is recorded", async () => {
    const user = await learner();
    const skill = await skillFixture();
    const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });
    const block = await questionBlock({ itemId: item.id, userId: user.id });
    mockSession(user.id);

    await expect(ask(item.id, block.id)).resolves.toMatchObject({ status: "created" });
  });

  it("rechecks private visibility when reading or claiming an existing public-item turn", async () => {
    const [user, owner] = await Promise.all([learner(), userFixture()]);
    const skill = await skillFixture();
    const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });
    await attemptFixture({ itemId: item.id, userId: user.id });
    mockSession(user.id);
    const created = await ask(item.id);

    expect(created.status).toBe("created");

    if (created.status !== "created") {
      throw new Error("Expected an item tutor question");
    }

    await prisma.skill.update({
      data: { ownerId: owner.id, visibility: "private" },
      where: { id: skill.id },
    });

    await expect(getLessonQuestion({ questionId: created.question.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(
      claimLessonQuestionAnswer({
        questionId: created.question.id,
        requestedModel: "openai/gpt-6-luna",
      }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
