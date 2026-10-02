import { prisma } from "@zoonk/db";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../../_test-utils/deferred-work";
import { mockSession } from "../../_test-utils/mock-session";
import { trackServerEvent } from "../../analytics/server";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { getChapterTestOut } from "./get-chapter-test-out";
import { requestTestOutQuestions } from "./request-test-out-questions";
import { submitChapterTestOut } from "./submit-chapter-test-out";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(async () => false),
}));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("../../analytics/server", () => ({ trackServerEvent: vi.fn() }));

const RIGHT = { selectedIndex: 0 };
const WRONG = { selectedIndex: 1 };

async function setup() {
  const user = await userFixture();
  const fixture = await learnerGoalFixture({ itemsPerSkill: 1, phases: [4, 2], userId: user.id });
  mockSession(user.id);

  return { ...fixture, user };
}

describe(getChapterTestOut, () => {
  it("asks one question per chapter skill, without the answers", async () => {
    const { chapters, goal, skills } = await setup();

    const result = await getChapterTestOut({ chapterId: chapters[0]?.id ?? "", goalId: goal.id });

    expect(result.status).toBe("ready");

    expect(
      result.status === "ready" && result.testOut.questions.map((question) => question.skillId),
    ).toStrictEqual(skills.slice(0, 4).map((skill) => skill.id));

    expect(result.status === "ready" && result.testOut.passMark).toBe(0.8);
    expect(JSON.stringify(result)).not.toContain("isCorrect");
  });

  it("doesn't test out a chapter outside the goal's plan", async () => {
    const { goal } = await setup();
    const elsewhere = await libraryChapterFixture();

    await expect(
      getChapterTestOut({ chapterId: elsewhere.id, goalId: goal.id }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});

describe(requestTestOutQuestions, () => {
  it("asks for nothing when every sampled skill has a question", async () => {
    const { chapters, goal, user } = await setup();

    await expect(
      requestTestOutQuestions({ chapterId: chapters[0]?.id ?? "", goalId: goal.id }),
    ).resolves.toStrictEqual({ status: "ready" });

    await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("names the skills without questions and counts the request as small AI help", async () => {
    const { chapters, goal, items, skills, user } = await setup();
    const chapterSkills = skills.slice(0, 4);

    await prisma.item.deleteMany({
      where: {
        id: {
          in: items.filter((item) => item.skillId === chapterSkills[1]?.id).map((item) => item.id),
        },
      },
    });

    const result = await requestTestOutQuestions({
      chapterId: chapters[0]?.id ?? "",
      goalId: goal.id,
    });

    expect(result).toMatchObject({
      analytics: { distinctId: user.id, goalId: goal.id },
      skillIds: [chapterSkills[1]?.id],
      status: "start",
    });

    await expect(
      prisma.usageRecord.count({ where: { kind: "assist", userId: user.id } }),
    ).resolves.toBe(1);
  });

  it("hides another learner's goal", async () => {
    const { chapters, goal } = await setup();
    const other = await userFixture();
    mockSession(other.id);

    await expect(
      requestTestOutQuestions({ chapterId: chapters[0]?.id ?? "", goalId: goal.id }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});

describe(submitChapterTestOut, () => {
  it("tests out the chapter when the learner passes, except what they missed", async () => {
    const { chapters, goal, items, planItems, skills, user } = await setup();
    const chapterItems = items.slice(0, 4);
    const flush = runDeferredWork();

    const result = await submitChapterTestOut({
      chapterId: chapters[0]?.id ?? "",
      goalId: goal.id,
      input: {
        answers: chapterItems.map((item, index) => ({
          answer: index === 3 ? WRONG : RIGHT,
          durationMs: 8000,
          itemId: item.id,
        })),
      },
    });

    // 3 of 4 is 75%, below the pass mark.
    expect(result.status === "ready" && result.outcome.passed).toBe(false);

    expect(result.status === "ready" && result.outcome.knownSkillIds).toStrictEqual(
      skills.slice(0, 3).map((skill) => skill.id),
    );

    await expect(
      prisma.planItem.count({ where: { planId: planItems[0]?.planId, status: "testedOut" } }),
    ).resolves.toBe(0);

    await expect(prisma.mistake.count({ where: { userId: user.id } })).resolves.toBe(0);

    await flush();

    expect(trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: user.id,
        name: "Test-out Taken",
        properties: { chapter_id: chapters[0]?.id, passed: false, score: 75 },
        shared: expect.objectContaining({ goal_kind: goal.kind }),
      }),
    );
  });

  it("marks the whole chapter known and skips its plan items on a pass", async () => {
    const { chapters, goal, items, planItems, skills, user } = await setup();

    const result = await submitChapterTestOut({
      chapterId: chapters[0]?.id ?? "",
      goalId: goal.id,
      input: {
        answers: items
          .slice(0, 4)
          .map((item) => ({ answer: RIGHT, durationMs: 8000, itemId: item.id })),
      },
    });

    expect(result.status === "ready" && result.outcome).toMatchObject({
      correct: 4,
      missedSkillIds: [],
      passed: true,
      testedOutPlanItemIds: planItems.slice(0, 4).map((item) => item.id),
      total: 4,
    });

    const known = await prisma.learnerSkill.findMany({ where: { userId: user.id } });

    expect(known.map((row) => row.skillId).toSorted()).toStrictEqual(
      skills
        .slice(0, 4)
        .map((skill) => skill.id)
        .toSorted(),
    );

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: planItems[4]?.id } }),
    ).resolves.toMatchObject({ status: "todo" });
  });

  it("rejects answers to another chapter's questions", async () => {
    const { chapters, goal, items } = await setup();

    const result = await submitChapterTestOut({
      chapterId: chapters[0]?.id ?? "",
      goalId: goal.id,
      input: { answers: [{ answer: RIGHT, durationMs: 8000, itemId: items[5]?.id ?? "" }] },
    });

    expect(result).toStrictEqual({ status: "invalidItem" });
  });
});
