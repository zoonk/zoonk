import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { mockSession } from "../../_test-utils/mock-session";
import { createLessonQuestion } from "../../lesson-questions/create-lesson-question";
import { answerBlockInOrder } from "../_test-utils/answer-block";
import { toBlockPayload } from "../block-payload";
import { finishStudyBlock } from "../finish-study-block";
import { startStudyBlock } from "../start-study-block";
import { loadMissionMoment } from "./mission-moment";

async function learner() {
  const user = await userFixture();
  const goal = await goalFixture({ timezone: "UTC", userId: user.id });
  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

  const session = await studySessionFixture({
    goalId: goal.id,
    missions: { picks: [{ anchor: {}, kind: "askBuddy", total: 1 }], version: 1 },
    userId: user.id,
  });

  const { lesson } = await playableLessonFixture();
  mockSession(user.id);

  const request = {
    input: {
      context: { kind: "lesson" as const },
      question: "Why does this work?",
      requestId: crypto.randomUUID(),
    },
    target: { kind: "lesson" as const, lessonId: lesson.id },
  };

  return { request, session, user };
}

describe("mission reward recovery", () => {
  it("preserves payout attribution when the first session block opens afterward", async () => {
    freezeClock();
    const { request, session, user } = await learner();
    const skill = await skillFixture();
    const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

    const block = await studySessionBlockFixture({
      kind: "practice",
      payload: toBlockPayload({ itemIds: [item.id], skillIds: [skill.id] }),
      sessionId: session.id,
    });

    const created = await createLessonQuestion(request);

    if (created.status !== "created") {
      throw new Error("Expected the learner's question to be stored.");
    }

    const source = { id: created.question.id, kind: "buddyQuestion" };
    const reward = await loadMissionMoment({ source, timeZone: "UTC", userId: user.id });
    expect(reward).not.toBeNull();

    await expect(
      startStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(
      loadMissionMoment({ source, timeZone: "UTC", userId: user.id }),
    ).resolves.toStrictEqual(reward);

    await expect(
      prisma.learningEvent.findFirstOrThrow({
        where: {
          contentIds: { equals: session.id, path: ["studySessionId"] },
          kind: "session",
          userId: user.id,
        },
      }),
    ).resolves.toMatchObject({ brainPower: 50 });

    await expect(
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ totalBrainPower: 50n });

    await answerBlockInOrder({ blockId: block.id, sessionId: session.id });

    await expect(
      finishStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(
      loadMissionMoment({ source, timeZone: "UTC", userId: user.id }),
    ).resolves.toStrictEqual(reward);
  });

  it("repairs a failed milestone stage without paying the committed bonus again", async () => {
    freezeClock();
    const { request, user } = await learner();
    await prisma.userProgress.create({ data: { totalBrainPower: 2470n, userId: user.id } });
    const identifier = `mission_milestone_${crypto.randomUUID().replaceAll("-", "")}`;
    // Identifiers cannot be query parameters; interpolated identifiers and UUID belong to this test.
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION ${identifier}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.user_id = '${user.id}'::uuid THEN RAISE EXCEPTION 'mission milestone interrupted'; END IF; RETURN NEW; END; $$`,
    );

    try {
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER ${identifier} BEFORE INSERT ON milestones FOR EACH ROW EXECUTE FUNCTION ${identifier}()`,
      );

      await expect(createLessonQuestion(request)).rejects.toThrow("mission milestone interrupted");
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${identifier} ON milestones`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION ${identifier}()`);
    }

    await expect(
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ totalBrainPower: 2520n });

    await expect(createLessonQuestion(request)).resolves.toMatchObject({ status: "created" });

    await expect(
      prisma.milestone.findMany({ where: { kind: "belt", userId: user.id } }),
    ).resolves.toContainEqual(expect.objectContaining({ key: "yellow" }));

    await expect(
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ totalBrainPower: 2520n });
  });
});
