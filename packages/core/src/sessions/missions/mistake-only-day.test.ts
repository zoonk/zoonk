import { prisma } from "@zoonk/db";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { answerMistakePractice } from "../../mistakes/answer-mistake-practice";
import { finishMistakePractice } from "../../mistakes/finish-mistake-practice";
import { getTodayView } from "../../view-models/today/get-today-view";
import { SESSION_NOW, daysAgo, sessionGoalFixture } from "../_test-utils/session-goal";

describe("a day with only original mistakes to practice", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("offers the notebook without a substitute block and saves its mission before answering", async () => {
    const user = await userFixture();

    const { goal, plan, skills } = await sessionGoalFixture({
      challengesDone: true,
      lessons: 1,
      userId: user.id,
    });

    await prisma.planItem.updateMany({ data: { status: "done" }, where: { planId: plan.id } });

    const item = await itemFixture({
      content: choiceItemContent("The original notebook question"),
      skillId: skills[0]?.id ?? "",
    });

    const mistake = await mistakeFixture({
      cause: "misread",
      createdAt: daysAgo(1),
      itemId: item.id,
      skillId: item.skillId,
      snapshot: { answer: "Wrong answer", question: "The original notebook question" },
      userId: user.id,
    });

    mockSession(user.id);

    const today = await getTodayView({ goalId: goal.id, timeZone: "UTC" });

    expect(today).toMatchObject({
      status: "ready",
      today: {
        session: {
          blocks: [],
          missions: [{ kind: "fixMistake", opens: { kind: "mistakesPractice" } }],
          status: "unstarted",
        },
      },
    });

    await expect(prisma.studySession.count({ where: { userId: user.id } })).resolves.toBe(0);

    const answered = await answerMistakePractice({
      input: {
        answer: { selectedIndex: 0 },
        durationMs: 5000,
        itemId: item.id,
        run: { answerIds: [], goalId: goal.id },
        timeZone: "UTC",
      },
      mistakeId: mistake.id,
    });

    if (answered.status !== "ready") {
      throw new Error(`Expected a saved notebook answer, got ${answered.status}`);
    }

    expect(answered.feedback.fixed).toBe(true);

    await expect(
      finishMistakePractice({
        answerIds: [answered.feedback.answerId],
        ended: true,
        goalId: goal.id,
        timeZone: "UTC",
      }),
    ).resolves.toMatchObject({
      result: { missionMoment: { completed: ["fixMistake"] } },
      status: "ready",
    });

    await expect(
      prisma.studySession.findFirst({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ missions: { picks: [{ kind: "fixMistake" }] } });
  });
});
