import { prisma } from "@zoonk/db";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { guardianLinkFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import {
  SESSION_NOW,
  SESSION_TODAY,
  daysAgo,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { addAreaPracticeBlock } from "./add-area-practice-block";
import { readBlockPayload } from "./block-payload";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** A goal with two chapters (the areas) of two skills each, every skill studied a while ago. */
async function setup() {
  const user = await userFixture();
  const fixture = await learnerGoalFixture({ itemsPerSkill: 2, phases: [2, 2], userId: user.id });

  await Promise.all(
    fixture.skills.map((skill) =>
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
  return { ...fixture, user };
}

describe(addAreaPracticeBlock, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires a session, the learner's own goal and a known area", async () => {
    const { chapters, goal } = await setup();
    const input = { areaId: chapters[0]?.id ?? "", timeZone: "UTC" };

    mockSession(null);

    await expect(addAreaPracticeBlock({ goalId: goal.id, input })).resolves.toStrictEqual({
      status: "unauthorized",
    });

    const other = await userFixture();
    mockSession(other.id);

    await expect(addAreaPracticeBlock({ goalId: goal.id, input })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("adds capped practice on only that area's skills, and a second tap opens the same block", async () => {
    const { chapters, goal, skills } = await setup();
    const input = { areaId: chapters[1]?.id ?? "", timeZone: "UTC" };

    const first = await addAreaPracticeBlock({ goalId: goal.id, input });

    expect(first).toMatchObject({
      block: { extra: true, kind: "practice", status: "pending", title: "Chapter 2" },
      status: "ready",
    });

    const blockId = first.status === "ready" ? first.block.id : "";
    const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });
    const { itemIds } = readBlockPayload(block);
    const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });
    const areaSkillIds = new Set([skills[2]?.id, skills[3]?.id]);

    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => areaSkillIds.has(item.skillId))).toBe(true);

    await expect(addAreaPracticeBlock({ goalId: goal.id, input })).resolves.toMatchObject({
      block: { id: blockId },
      status: "ready",
    });
  });

  it("gives two taps at once on two areas each its own area's block", { repeats: 10 }, async () => {
    const { chapters, goal, skills } = await setup();
    const [firstArea = "", secondArea = ""] = chapters.map((chapter) => chapter.id);

    const [first, second] = await Promise.all(
      [firstArea, secondArea].map((areaId) =>
        addAreaPracticeBlock({ goalId: goal.id, input: { areaId, timeZone: "UTC" } }),
      ),
    );

    const blocks = await prisma.studySessionBlock.findMany({
      where: {
        id: {
          in: [first, second].flatMap((result) =>
            result?.status === "ready" ? [result.block.id] : [],
          ),
        },
      },
    });

    const areaOf = (blockId: string | undefined) =>
      blocks.find((block) => block.id === blockId) ?? null;

    const firstBlock = areaOf(first?.status === "ready" ? first.block.id : undefined);
    const secondBlock = areaOf(second?.status === "ready" ? second.block.id : undefined);

    expect(firstBlock && readBlockPayload(firstBlock).areaId).toBe(firstArea);
    expect(secondBlock && readBlockPayload(secondBlock).areaId).toBe(secondArea);
    expect(firstBlock?.id).not.toBe(secondBlock?.id);
    expect(firstBlock?.position).not.toBe(secondBlock?.position);

    const firstSkills = new Set([skills[0]?.id, skills[1]?.id]);

    const firstItems = await prisma.item.findMany({
      where: { id: { in: firstBlock ? readBlockPayload(firstBlock).itemIds : [] } },
    });

    expect(firstItems.every((item) => firstSkills.has(item.skillId))).toBe(true);
  });

  it("counts toward the day's two bonus blocks", async () => {
    const { chapters, goal } = await setup();

    const [firstArea = "", secondArea = ""] = chapters.map((chapter) => chapter.id);

    // One after the other: each bonus block goes at the end of the session.
    await addAreaPracticeBlock({ goalId: goal.id, input: { areaId: firstArea, timeZone: "UTC" } });
    await addAreaPracticeBlock({ goalId: goal.id, input: { areaId: secondArea, timeZone: "UTC" } });

    const blocks = await prisma.studySessionBlock.findMany({
      where: { session: { goalId: goal.id } },
    });

    expect(blocks.filter((block) => readBlockPayload(block).extra)).toHaveLength(2);

    await prisma.studySessionBlock.updateMany({
      data: { status: "completed" },
      where: { session: { goalId: goal.id } },
    });

    await expect(
      addAreaPracticeBlock({ goalId: goal.id, input: { areaId: firstArea, timeZone: "UTC" } }),
    ).resolves.toStrictEqual({ reason: "dailyCap", status: "unavailable" });
  });

  it("opens the area's next lesson when nothing there is studied yet", async () => {
    const user = await userFixture();
    const { goal, lessons } = await sessionGoalFixture({ lessons: 2, userId: user.id });
    mockSession(user.id);

    // These lessons have no chapter yet, so their area is the plan's first phase.
    const result = await addAreaPracticeBlock({
      goalId: goal.id,
      input: { areaId: "phase:0", timeZone: "UTC" },
    });

    expect(result).toMatchObject({
      block: { extra: true, kind: "learn", lessonId: lessons[0]?.id },
      status: "ready",
    });
  });

  it("says when an area has nothing left to practice or learn", async () => {
    const user = await userFixture();
    const { chapters, goal, plan } = await learnerGoalFixture({ phases: [1], userId: user.id });
    await prisma.planItem.updateMany({ data: { status: "done" }, where: { planId: plan.id } });
    mockSession(user.id);

    await expect(
      addAreaPracticeBlock({
        goalId: goal.id,
        input: { areaId: chapters[0]?.id ?? "", timeZone: "UTC" },
      }),
    ).resolves.toStrictEqual({ status: "nothingToPractice" });

    await expect(
      addAreaPracticeBlock({ goalId: goal.id, input: { areaId: "not-an-area", timeZone: "UTC" } }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });

  it("fits a guardian's daily limit, and adds nothing once too little of it is left", async () => {
    const { chapters, goal, user } = await setup();
    const input = { areaId: chapters[0]?.id ?? "", timeZone: "UTC" };

    await Promise.all([
      guardianLinkFixture({ dailyLimitMinutes: 10, status: "active", userId: user.id }),
      dailyProgressFixtureMany([
        { date: SESSION_TODAY, timeSpentSeconds: 7 * 60, userId: user.id },
      ]),
    ]);

    const fitted = await addAreaPracticeBlock({ goalId: goal.id, input });

    // Three minutes are left: two questions instead of the area's four.
    expect(fitted).toMatchObject({ block: { estimatedMinutes: 3, questions: 2 }, status: "ready" });

    await prisma.dailyProgress.updateMany({
      data: { timeSpentSeconds: 9 * 60 },
      where: { userId: user.id },
    });

    await expect(
      addAreaPracticeBlock({ goalId: goal.id, input: { ...input, areaId: chapters[1]?.id ?? "" } }),
    ).resolves.toStrictEqual({ reason: "dailyLimit", status: "unavailable" });
  });
});
