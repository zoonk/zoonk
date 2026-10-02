import { prisma } from "@zoonk/db";
import { learnerSkillFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import {
  NET_SCORED_EXAM_STRUCTURE,
  SESSION_NOW,
  daysAgo,
  sessionGoalFixture,
  statementContent,
} from "./_test-utils/session-goal";
import { addAreaPracticeBlock } from "./add-area-practice-block";
import { answerStudyQuestion } from "./answer-study-question";
import { finishStudyBlock } from "./finish-study-block";
import { getStudyBlock } from "./get-study-block";
import { getTodayStudySession } from "./get-today-study-session";
import { startStudyBlock } from "./start-study-block";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({ classifyMistakeCause: vi.fn() }));

/**
 * A Cebraspe-style exam goal whose lesson is done, with two false statements on its skill and a
 * mistake on the first, so today's practice drills it: that question, then the other one.
 */
async function netScoredPracticeDay() {
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

  const [blank, wrong] = await Promise.all(
    [false, false].map((isTrue) =>
      itemFixture({ content: statementContent(isTrue), format: "trueFalse", skillId }),
    ),
  );

  await Promise.all([
    prisma.planItem.update({ data: { status: "done" }, where: { id: planItems[0]?.id } }),
    mistakeFixture({ createdAt: daysAgo(2), itemId: blank?.id, skillId, userId: user.id }),
  ]);

  mockSession(user.id);

  return { goal, ids: { blank: blank?.id, wrong: wrong?.id } };
}

describe("net-scored practice", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lets a Cebraspe goal's practice leave statements blank and scores it net", async () => {
    const { goal, ids } = await netScoredPracticeDay();
    const today = await getTodayStudySession({ goalId: goal.id });
    const session = today.status === "ready" ? today.session : null;
    const practice = session?.blocks.find((block) => block.kind === "practice");
    const ref = { blockId: practice?.id ?? "", sessionId: session?.id ?? "" };

    expect(practice).toMatchObject({ netScored: true });

    await startStudyBlock({ ...ref, input: {} });
    const detail = await getStudyBlock(ref);
    const questions = detail.status === "ready" ? detail.detail.questions : [];

    expect(detail).toMatchObject({ detail: { block: { netScored: true } } });

    expect(new Set(questions.map((question) => question.itemId))).toStrictEqual(
      new Set([ids.blank, ids.wrong]),
    );

    // The drilled statement left blank, and the other false one answered true (wrong).
    await questions.reduce(async (previous, question) => {
      await previous;

      await answerStudyQuestion({
        ...ref,
        input: {
          answer: question.itemId === ids.blank ? { dontKnow: true } : { isTrue: true },
          durationMs: 2000,
          itemId: question.itemId,
        },
      });
    }, Promise.resolve());

    // The wrong answer costs a point; the blank costs nothing.
    await expect(finishStudyBlock({ ...ref, input: {} })).resolves.toMatchObject({
      completion: { correct: 0, netScore: -1, total: 2 },
      status: "ready",
    });
  });

  it("scores an area's extra practice like the goal's exam", async () => {
    const user = await userFixture();

    const { chapters, goal, skills } = await learnerGoalFixture({
      phases: [2, 2],
      userId: user.id,
    });

    await Promise.all(
      skills.map((skill) =>
        learnerSkillFixture({
          difficulty: 5,
          lastReviewedAt: daysAgo(3),
          reps: 2,
          skillId: skill.id,
          stability: 2,
          state: "learning",
          userId: user.id,
        }),
      ),
    );

    mockSession(user.id);

    const practiceArea = (areaId: string | undefined) =>
      addAreaPracticeBlock({ goalId: goal.id, input: { areaId: areaId ?? "", timeZone: "UTC" } });

    await expect(practiceArea(chapters[0]?.id)).resolves.toMatchObject({
      block: { kind: "practice", netScored: false },
      status: "ready",
    });

    const blueprint = await examBlueprintFixture({ structure: NET_SCORED_EXAM_STRUCTURE });

    await prisma.goal.update({
      data: { examBlueprintId: blueprint.id, kind: "exam" },
      where: { id: goal.id },
    });

    await expect(practiceArea(chapters[1]?.id)).resolves.toMatchObject({
      block: { kind: "practice", netScored: true },
      status: "ready",
    });
  });
});
