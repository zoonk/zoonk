import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { finishChallengesFixture } from "../plans/_test-utils/finish-challenges";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { parsePlanChangePayload } from "../plans/_utils/plan-change-payload";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { getTodayStudySession } from "./_test-utils/open-today";
import { answerStudyQuestion } from "./answer-study-question";
import { getStudyBlock } from "./get-study-block";
import { startStudyBlock } from "./start-study-block";

const TIME_ZONE = "UTC";
const DAY_MS = 86_400_000;

describe("a miss on a topic below the known bar", () => {
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

  it("doesn't tell the learner the topic came back", async () => {
    const user = await userFixture();

    const library = await planLibraryFixture({
      skills: [
        { area: "Cells", lessons: 2 },
        { area: "Biology", lessons: 2 },
      ],
    });

    const { goal, plan } = await unplannedGoalFixture({
      createdAt: new Date(Date.now() - DAY_MS),
      timezone: TIME_ZONE,
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    await finishChallengesFixture(plan.id);

    const items = await Promise.all(
      library.skills.flatMap((skill) =>
        [0, 1].map(() => itemFixture({ content: choiceItemContent(), skillId: skill.id })),
      ),
    );

    await Promise.all(
      library.skills.map((skill) =>
        attemptFixture({
          answeredAt: new Date(Date.now() - DAY_MS),
          isCorrect: true,
          isPlacement: true,
          itemId: items.find((item) => item.skillId === skill.id)!.id,
          skillId: skill.id,
          userId: user.id,
        }),
      ),
    );

    mockSession(user.id);

    const today = await getTodayStudySession({ goalId: goal.id, timeZone: TIME_ZONE });
    const session = today.status === "ready" ? today.session : null;
    const review = session!.blocks.find((block) => block.kind === "review")!;

    await startStudyBlock({ blockId: review.id, input: {}, sessionId: session!.id });

    const block = await getStudyBlock({ blockId: review.id, sessionId: session!.id });
    const questions = block.status === "ready" ? block.detail.questions : [];
    const asked = questions.find((question) => "placement" in question && question.placement);

    const lessonsBefore = await prisma.planItem.findMany({
      where: { kind: "lesson", planId: plan.id },
    });

    expect([...new Set(lessonsBefore.map((item) => item.status))]).toStrictEqual(["todo"]);

    const result = await answerStudyQuestion({
      blockId: review.id,
      input: {
        answer: { selectedIndex: 1 },
        durationMs: 3000,
        itemId: asked && "itemId" in asked ? (asked.itemId ?? "") : "",
        timeZone: TIME_ZONE,
      },
      sessionId: session!.id,
    });

    expect(result).toMatchObject({ feedback: { isCorrect: false }, status: "ready" });

    const relearn = await prisma.planChange.findMany({
      where: { kind: "relearn", planId: plan.id },
    });

    expect(
      relearn.map((change) => ({
        status: change.status,
        topicsAdded: parsePlanChangePayload(change.payload).effect?.topicsAdded,
      })),
    ).toStrictEqual([]);
  });
});
