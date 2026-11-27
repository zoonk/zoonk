import { prisma } from "@zoonk/db";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { pickInMistake } from "../../_test-utils/shown-choice";
import { answerMistakePractice } from "../../mistakes/answer-mistake-practice";
import { getTodayView } from "../../view-models/today/get-today-view";
import { SESSION_NOW, daysAgo, sessionGoalFixture } from "../_test-utils/session-goal";
import { openStudyDay } from "../open-study-day";

describe("a day with only original mistakes to practice", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("offers the original mistake as the day’s only block", async () => {
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
          blocks: [{ questions: 1, screen: "mistakesPractice", status: "pending" }],
          missions: [{ kind: "askBuddy", minutes: 2 }],
          status: "unstarted",
        },
      },
    });

    await expect(prisma.studySession.count({ where: { userId: user.id } })).resolves.toBe(0);

    await expect(
      openStudyDay({ goalId: goal.id, shownDate: "2026-09-30", timeZone: "UTC" }),
    ).resolves.toMatchObject({ status: "opened" });

    const block = await prisma.studySessionBlock.findFirstOrThrow({
      where: { session: { goalId: goal.id, userId: user.id } },
    });

    expect(block.payload).toMatchObject({ mistakeIds: [mistake.id] });

    await expect(
      answerMistakePractice({
        input: {
          answer: await pickInMistake({ mistakeId: mistake.id }),
          durationMs: 5000,
          itemId: item.id,
          run: { answerIds: [], blockId: block.id },
          timeZone: "UTC",
        },
        mistakeId: mistake.id,
      }),
    ).resolves.toMatchObject({ feedback: { fixed: true }, status: "ready" });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "completed" });
  });
});
