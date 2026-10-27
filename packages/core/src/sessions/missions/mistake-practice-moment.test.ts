import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { recordLearnerAnswer } from "../../learner/record-learner-answer";
import { answerMistakePractice } from "../../mistakes/answer-mistake-practice";
import { finishMistakePractice } from "../../mistakes/finish-mistake-practice";
import { STUDY_SESSION_INCLUDE } from "../_utils/study-session-access";
import { startStudyBlock } from "../start-study-block";
import { getDayMissions } from "./get-day-missions";

const NOW = new Date("2026-10-14T12:00:00Z");
const TODAY = new Date("2026-10-14");

describe("notebook practice mission moments", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("announces a fixed mistake before the other missions are done", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
    const goal = await goalFixture({ timezone: "UTC", userId: user.id });

    const [item, extra] = await Promise.all([
      itemFixture({ content: choiceItemContent(), skillId: skill.id }),
      itemFixture({ content: choiceItemContent(), skillId: skill.id }),
    ]);

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: TODAY,
      missions: {
        picks: [
          { anchor: { blockKind: "review" }, kind: "review", total: 1 },
          { anchor: {}, kind: "fixMistake", total: 1 },
        ],
        version: 1,
      },
      userId: user.id,
    });

    const [, mistake] = await Promise.all([
      studySessionBlockFixture({ kind: "review", sessionId: session.id }),
      mistakeFixture({
        cause: "misread",
        createdAt: new Date("2026-10-07"),
        itemId: item.id,
        skillId: skill.id,
        userId: user.id,
      }),
    ]);

    mockSession(user.id);

    const answered = await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 5000, itemId: extra.id, timeZone: "UTC" },
      mistakeId: mistake.id,
    });

    expect(answered).toMatchObject({ feedback: { fixed: true }, status: "ready" });

    if (answered.status !== "ready") {
      throw new Error(`Practice answer failed: ${answered.status}`);
    }

    const input = { answerIds: [answered.feedback.answerId], ended: true, timeZone: "UTC" };

    const [result, concurrentRetry] = await Promise.all([
      finishMistakePractice(input),
      finishMistakePractice(input),
    ]);

    expect(concurrentRetry).toStrictEqual(result);

    expect(result).toMatchObject({
      result: {
        missionMoment: {
          completed: ["fixMistake"],
          fullMeal: { paid: false },
          missions: [
            { kind: "review", status: "todo" },
            { kind: "fixMistake", status: "done" },
          ],
        },
      },
      status: "ready",
    });

    await expect(finishMistakePractice(input)).resolves.toStrictEqual(result);

    const saved = await prisma.studySession.findUniqueOrThrow({
      include: STUDY_SESSION_INCLUDE,
      where: { id: session.id },
    });

    expect(saved.fullMealAt).toBeNull();

    await expect(getDayMissions({ session: saved, timeZone: "UTC" })).resolves.toMatchObject([
      { kind: "review", status: "todo" },
      { kind: "fixMistake", status: "done" },
    ]);

    // The session's first block captures a start state after the off-session mission completed.
    await expect(
      startStudyBlock({
        blockId: saved.blocks[0]!.id,
        input: { timeZone: "UTC" },
        sessionId: saved.id,
      }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(finishMistakePractice(input)).resolves.toStrictEqual(result);

    vi.setSystemTime(new Date(NOW.getTime() + 1000));

    const laterMistake = await mistakeFixture({
      cause: "misread",
      createdAt: new Date("2026-10-07"),
      itemId: item.id,
      skillId: skill.id,
      userId: user.id,
    });

    const later = await answerMistakePractice({
      input: { answer: { selectedIndex: 0 }, durationMs: 5000, itemId: item.id, timeZone: "UTC" },
      mistakeId: laterMistake.id,
    });

    expect(later).toMatchObject({ feedback: { fixed: true }, status: "ready" });

    if (later.status !== "ready") {
      throw new Error(`Practice answer failed: ${later.status}`);
    }

    await expect(
      finishMistakePractice({ ...input, answerIds: [later.feedback.answerId] }),
    ).resolves.toMatchObject({ result: { missionMoment: null }, status: "ready" });

    await expect(finishMistakePractice(input)).resolves.toStrictEqual(result);
  });

  it.each([
    [false, false, false, false],
    [true, false, false, false],
    [true, true, false, false],
    [true, false, true, false],
    [true, true, false, true],
  ])(
    "does not claim an ordinary session's correction (unknown: %s, reopened: %s, review done: %s, refixed elsewhere: %s)",
    async (dontKnow, reopened, reviewDone, refixed) => {
      const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
      const goal = await goalFixture({ timezone: "UTC", userId: user.id });

      const [ordinaryItem, practiceItem] = await Promise.all([
        itemFixture({ content: choiceItemContent(), skillId: skill.id }),
        itemFixture({ content: choiceItemContent(), skillId: skill.id }),
      ]);

      const session = await studySessionFixture({
        goalId: goal.id,
        localDate: TODAY,
        missions: {
          picks: [
            { anchor: { blockKind: "review" }, kind: "review", total: 1 },
            { anchor: {}, kind: "fixMistake", total: 1 },
          ],
          version: 1,
        },
        userId: user.id,
      });

      const [, ordinaryMistake, practiceMistake] = await Promise.all([
        studySessionBlockFixture({
          kind: "review",
          sessionId: session.id,
          ...(reviewDone && { completedAt: NOW, status: "completed" }),
        }),
        mistakeFixture({
          cause: "misread",
          createdAt: new Date("2026-10-07"),
          itemId: ordinaryItem.id,
          skillId: skill.id,
          userId: user.id,
        }),
        mistakeFixture({
          cause: "gap",
          createdAt: new Date("2026-10-07"),
          itemId: practiceItem.id,
          skillId: skill.id,
          userId: user.id,
        }),
      ]);

      const ordinary = await recordLearnerAnswer({
        answer: { selectedIndex: 0 },
        graded: { durationMs: 5000, isCorrect: true },
        itemId: ordinaryItem.id,
        language: "en",
        purpose: "learning",
        skillId: skill.id,
        studySessionId: session.id,
        timeZone: "UTC",
        userId: user.id,
      });

      expect(ordinary.fixedMistakeIds).toStrictEqual([ordinaryMistake.id]);

      vi.setSystemTime(new Date(NOW.getTime() + 1000));
      mockSession(user.id);

      const corrected = reopened
        ? await answerMistakePractice({
            input: {
              answer: { selectedIndex: 0 },
              durationMs: 5000,
              itemId: practiceItem.id,
              timeZone: "UTC",
            },
            mistakeId: practiceMistake.id,
          })
        : null;

      if (corrected && corrected.status !== "ready") {
        throw new Error(`Practice answer failed: ${corrected.status}`);
      }

      vi.setSystemTime(new Date(NOW.getTime() + 2000));

      const answered = await answerMistakePractice({
        input: {
          answer: dontKnow ? { dontKnow: true } : { selectedIndex: 1 },
          durationMs: 5000,
          itemId: practiceItem.id,
          timeZone: "UTC",
        },
        mistakeId: practiceMistake.id,
      });

      expect(answered).toMatchObject({
        feedback: { fixed: false, isCorrect: false },
        status: "ready",
      });

      if (answered.status !== "ready") {
        throw new Error(`Practice answer failed: ${answered.status}`);
      }

      if (refixed) {
        vi.setSystemTime(new Date(NOW.getTime() + 3000));

        await recordLearnerAnswer({
          answer: { selectedIndex: 0 },
          graded: { durationMs: 5000, isCorrect: true },
          itemId: practiceItem.id,
          language: "en",
          purpose: "learning",
          skillId: skill.id,
          studySessionId: session.id,
          timeZone: "UTC",
          userId: user.id,
        });
      }

      await expect(
        prisma.mistake.findUniqueOrThrow({ where: { id: practiceMistake.id } }),
      ).resolves.toMatchObject({ status: refixed ? "fixed" : "open" });

      const input = {
        answerIds: [
          ...(corrected?.status === "ready" ? [corrected.feedback.answerId] : []),
          answered.feedback.answerId,
        ],
        ended: true,
        timeZone: "UTC",
      };

      await expect(finishMistakePractice(input)).resolves.toMatchObject({
        result: { missionMoment: null },
        status: "ready",
      });

      await expect(finishMistakePractice(input)).resolves.toMatchObject({
        result: { missionMoment: null },
        status: "ready",
      });

      const saved = await prisma.studySession.findUniqueOrThrow({
        include: STUDY_SESSION_INCLUDE,
        where: { id: session.id },
      });

      await expect(getDayMissions({ session: saved, timeZone: "UTC" })).resolves.toMatchObject([
        { kind: "review", status: reviewDone ? "done" : "todo" },
        { kind: "fixMistake", status: "done" },
      ]);

      expect(saved.fullMealAt !== null).toBe(reviewDone);
      expect(JSON.stringify(saved.startSnapshot)).not.toContain("fullMealSource");
      expect(JSON.stringify(saved.missions)).not.toContain("completedBy");
    },
  );
});
