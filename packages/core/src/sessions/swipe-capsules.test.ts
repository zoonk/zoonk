import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import {
  NET_SCORED_EXAM_STRUCTURE,
  SESSION_NOW,
  dueSkillFixture,
  sessionGoalFixture,
  statementContent,
} from "./_test-utils/session-goal";
import { answerStudyQuestion } from "./answer-study-question";
import { finishStudyBlock } from "./finish-study-block";
import { getStudyBlock } from "./get-study-block";
import { getTodayStudySession } from "./get-today-study-session";
import { startStudyBlock } from "./start-study-block";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({ classifyMistakeCause: vi.fn() }));

describe("swipe capsules", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens with true-or-false statements and scores them net for net-scored exams", async () => {
    const [user, blueprint] = await Promise.all([
      userFixture(),
      examBlueprintFixture({ structure: NET_SCORED_EXAM_STRUCTURE }),
    ]);

    const { goal, planItems, skills } = await sessionGoalFixture({
      goal: { examBlueprintId: blueprint.id, kind: "exam" },
      itemsPerSkill: 0,
      lessons: 1,
      userId: user.id,
    });

    const skillId = skills[0]?.id ?? "";

    await Promise.all([
      prisma.planItem.update({ data: { status: "done" }, where: { id: planItems[0]?.id } }),
      dueSkillFixture({ skillId, userId: user.id }),
      ...[true, true, false].map((isTrue) =>
        itemFixture({ content: statementContent(isTrue), format: "trueFalse", skillId }),
      ),
    ]);

    mockSession(user.id);
    const today = await getTodayStudySession({ goalId: goal.id });
    const session = today.status === "ready" ? today.session : null;
    const review = session?.blocks[0];

    expect(review?.capsules).toMatchObject([{ format: "swipe", questions: 3 }]);

    await startStudyBlock({ blockId: review?.id ?? "", input: {}, sessionId: session?.id ?? "" });
    const detail = await getStudyBlock({ blockId: review?.id ?? "", sessionId: session?.id ?? "" });
    const questions = detail.status === "ready" ? detail.detail.questions : [];

    // Swiping "true" on all three: two right and one wrong nets one.
    await questions.reduce(async (previous, question) => {
      await previous;

      await answerStudyQuestion({
        blockId: review?.id ?? "",
        input: { answer: { isTrue: true }, durationMs: 2000, itemId: question.itemId },
        sessionId: session?.id ?? "",
      });
    }, Promise.resolve());

    await expect(
      finishStudyBlock({ blockId: review?.id ?? "", input: {}, sessionId: session?.id ?? "" }),
    ).resolves.toMatchObject({
      completion: { correct: 2, netScore: 1, total: 3 },
      status: "ready",
    });
  });

  it("nets only the statements when the review also asks a matching question", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
    const goal = await goalFixture({ kind: "exam", timezone: "UTC", userId: user.id });

    const pairs = [
      { left: "10% of 50", right: "5" },
      { left: "25% of 40", right: "10" },
    ];

    const [statements, match, session] = await Promise.all([
      Promise.all(
        [true, true, false].map((isTrue) =>
          itemFixture({
            content: statementContent(isTrue),
            format: "trueFalse",
            skillId: skill.id,
          }),
        ),
      ),
      itemFixture({
        content: { pairs, question: "Match each percentage", reason: "Multiply." },
        format: "matchPairs",
        skillId: skill.id,
      }),
      studySessionFixture({ goalId: goal.id, localDate: new Date(SESSION_NOW), userId: user.id }),
    ]);

    const block = await studySessionBlockFixture({
      kind: "review",
      payload: {
        capsules: [
          {
            format: "swipe",
            itemIds: statements.map((item) => item.id),
            key: `skill:${skill.id}`,
            lessonId: null,
            skillIds: [skill.id],
            title: "Statements",
          },
          {
            format: "matchPairs",
            itemIds: [match.id],
            key: `match:${skill.id}`,
            lessonId: null,
            skillIds: [skill.id],
            title: "Percentages",
          },
        ],
        skillIds: [skill.id],
      },
      position: 0,
      sessionId: session.id,
    });

    mockSession(user.id);
    await startStudyBlock({ blockId: block.id, input: {}, sessionId: session.id });
    const detail = await getStudyBlock({ blockId: block.id, sessionId: session.id });
    const questions = detail.status === "ready" ? detail.detail.questions : [];

    // Every statement swiped "true" (two right, one wrong: net 1) and the pairs matched right,
    // which counts as right but never in the net.
    await questions.reduce(async (previous, question) => {
      await previous;

      const answer =
        question.format === "matchPairs"
          ? { matches: pairs.map((pair) => question.right?.indexOf(pair.right) ?? -1) }
          : { isTrue: true };

      await answerStudyQuestion({
        blockId: block.id,
        input: { answer, durationMs: 2000, itemId: question.itemId },
        sessionId: session.id,
      });
    }, Promise.resolve());

    await expect(
      finishStudyBlock({ blockId: block.id, input: {}, sessionId: session.id }),
    ).resolves.toMatchObject({
      completion: { correct: 3, netScore: 1, total: 4 },
      status: "ready",
    });
  });

  it("counts a statement left blank as neither right nor wrong in the net score", async () => {
    const [user, blueprint] = await Promise.all([
      userFixture(),
      examBlueprintFixture({ structure: NET_SCORED_EXAM_STRUCTURE }),
    ]);

    const { goal, planItems, skills } = await sessionGoalFixture({
      goal: { examBlueprintId: blueprint.id, kind: "exam" },
      itemsPerSkill: 0,
      lessons: 1,
      userId: user.id,
    });

    const skillId = skills[0]?.id ?? "";

    const [items] = await Promise.all([
      Promise.all(
        [true, true, false].map((isTrue) =>
          itemFixture({ content: statementContent(isTrue), format: "trueFalse", skillId }),
        ),
      ),
      prisma.planItem.update({ data: { status: "done" }, where: { id: planItems[0]?.id } }),
      dueSkillFixture({ skillId, userId: user.id }),
    ]);

    const falseItemId = items[2]?.id;

    mockSession(user.id);
    const today = await getTodayStudySession({ goalId: goal.id });
    const session = today.status === "ready" ? today.session : null;
    const review = session?.blocks[0];

    await startStudyBlock({ blockId: review?.id ?? "", input: {}, sessionId: session?.id ?? "" });
    const detail = await getStudyBlock({ blockId: review?.id ?? "", sessionId: session?.id ?? "" });
    const questions = detail.status === "ready" ? detail.detail.questions : [];

    // Both true statements swiped right, the false one left blank: the blank cancels nothing.
    await questions.reduce(async (previous, question) => {
      await previous;

      await answerStudyQuestion({
        blockId: review?.id ?? "",
        input: {
          answer: question.itemId === falseItemId ? { dontKnow: true } : { isTrue: true },
          durationMs: 2000,
          itemId: question.itemId,
        },
        sessionId: session?.id ?? "",
      });
    }, Promise.resolve());

    await expect(
      finishStudyBlock({ blockId: review?.id ?? "", input: {}, sessionId: session?.id ?? "" }),
    ).resolves.toMatchObject({
      completion: { correct: 2, netScore: 2, total: 3 },
      status: "ready",
    });
  });
});
