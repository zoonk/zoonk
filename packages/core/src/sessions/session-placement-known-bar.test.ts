import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getGoalPlacement } from "../learner/placement/get-goal-placement";
import { finishChallengesFixture } from "../plans/_test-utils/finish-challenges";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { getTodayStudySession } from "./_test-utils/open-today";
import { answerStudyQuestion } from "./answer-study-question";
import { getStudyBlock } from "./get-study-block";
import { startStudyBlock } from "./start-study-block";

const TIME_ZONE = "UTC";
const DAY_MS = 86_400_000;

describe("one in-session multiple-choice test answer", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const now = new Date();

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
      currentInstant: now,
      timeZone: TIME_ZONE,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("needs two right answers before its lessons are skipped", async () => {
    const user = await userFixture();

    const library = await planLibraryFixture({
      skills: [
        { area: "Cells", lessons: 2 },
        { area: "Biology", lessons: 2 },
      ],
    });

    const target = library.skills[0]!.id;
    const other = library.skills[1]!.id;

    const { goal, plan } = await unplannedGoalFixture({
      createdAt: new Date(Date.now() - DAY_MS),
      timezone: TIME_ZONE,
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    await finishChallengesFixture(plan.id);

    const items = await Promise.all([
      itemFixture({ content: choiceItemContent(), skillId: target }),
      itemFixture({ content: choiceItemContent(), skillId: target }),
      itemFixture({ content: choiceItemContent(), skillId: other }),
    ]);

    await attemptFixture({
      answeredAt: new Date(Date.now() - DAY_MS),
      isCorrect: true,
      isPlacement: true,
      itemId: items[2]!.id,
      skillId: other,
      userId: user.id,
    });

    mockSession(user.id);

    const today = await getTodayStudySession({ goalId: goal.id, timeZone: TIME_ZONE });
    const session = today.status === "ready" ? today.session : null;
    const review = session!.blocks.find((block) => block.kind === "review")!;

    await startStudyBlock({ blockId: review.id, input: {}, sessionId: session!.id });

    const block = await getStudyBlock({ blockId: review.id, sessionId: session!.id });
    const questions = block.status === "ready" ? block.detail.questions : [];
    const asked = questions.find((question) => "placement" in question && question.placement);

    const result = await answerStudyQuestion({
      blockId: review.id,
      input: {
        answer: { selectedIndex: 0 },
        durationMs: 3000,
        itemId: asked && "itemId" in asked ? (asked.itemId ?? "") : "",
        timeZone: TIME_ZONE,
      },
      sessionId: session!.id,
    });

    const [lessons, rightAnswers, read] = await Promise.all([
      prisma.planItem.findMany({ where: { kind: "lesson", planId: plan.id, skillId: target } }),
      prisma.attempt.count({ where: { isCorrect: true, skillId: target, userId: user.id } }),
      getGoalPlacement({ goalId: goal.id }),
    ]);

    const statuses = [...new Set(lessons.map((item) => item.status))];

    expect(result.status).toBe("ready");
    expect(read.status === "ready" && read.placement.knownSkillIds.includes(target)).toBe(false);
    expect(rightAnswers).toBe(1);
    expect(statuses).toStrictEqual(["todo"]);
  });
});
