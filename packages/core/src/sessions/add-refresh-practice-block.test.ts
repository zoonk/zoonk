import { prisma } from "@zoonk/db";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { SESSION_NOW, daysAgo } from "./_test-utils/session-goal";
import { addRefreshPracticeBlock } from "./add-refresh-practice-block";
import { readBlockPayload } from "./block-payload";
import { getTodayStudySession } from "./get-today-study-session";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** A goal of four skills: the first two studied long ago and fading, the others fresh. */
async function setup() {
  const user = await userFixture();
  const fixture = await learnerGoalFixture({ itemsPerSkill: 2, phases: [2, 2], userId: user.id });

  await Promise.all(
    fixture.skills.map((skill, index) =>
      learnerSkillFixture({
        difficulty: 5,
        lastReviewedAt: index < 2 ? daysAgo(20) : SESSION_NOW,
        reps: 2,
        skillId: skill.id,
        stability: index < 2 ? 2 : 30,
        state: "learning",
        userId: user.id,
      }),
    ),
  );

  mockSession(user.id);
  return { ...fixture, user };
}

describe(addRefreshPracticeBlock, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires a session and the learner's own active goal", async () => {
    const { goal } = await setup();
    const input = { timeZone: "UTC" };

    mockSession(null);

    await expect(addRefreshPracticeBlock({ goalId: goal.id, input })).resolves.toStrictEqual({
      status: "unauthorized",
    });

    const other = await userFixture();
    mockSession(other.id);

    await expect(addRefreshPracticeBlock({ goalId: goal.id, input })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(goal.userId);
    await prisma.goal.update({ data: { status: "paused" }, where: { id: goal.id } });

    await expect(addRefreshPracticeBlock({ goalId: goal.id, input })).resolves.toStrictEqual({
      status: "goalNotActive",
    });
  });

  it("opens today's reviews of the fading skills before adding anything", async () => {
    const { goal, skills } = await setup();

    const result = await addRefreshPracticeBlock({ goalId: goal.id, input: { timeZone: "UTC" } });
    const blockId = result.status === "ready" ? result.block.id : "";
    const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });
    const payload = readBlockPayload(block);
    const fading = new Set([skills[0]?.id, skills[1]?.id]);

    const asked = [...payload.skillIds, ...payload.capsules.flatMap((capsule) => capsule.skillIds)];

    expect(payload.extra).toBe(false);
    expect(asked.some((skillId) => fading.has(skillId))).toBe(true);
  });

  it("practices only the fading skills once today's session is done", async () => {
    const { goal, skills } = await setup();
    const input = { timeZone: "UTC" };

    // Today's session is built on the first read; finish it so nothing in it is left to open.
    const today = await addRefreshPracticeBlock({ goalId: goal.id, input });
    const sessionId = today.status === "ready" ? today.sessionId : "";

    await prisma.studySessionBlock.updateMany({
      data: { status: "completed" },
      where: { sessionId },
    });

    const first = await addRefreshPracticeBlock({ goalId: goal.id, input });

    expect(first).toMatchObject({
      block: { extra: true, kind: "practice", status: "pending" },
      status: "ready",
    });

    const blockId = first.status === "ready" ? first.block.id : "";
    const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });

    const items = await prisma.item.findMany({
      where: { id: { in: readBlockPayload(block).itemIds } },
    });

    const fading = new Set([skills[0]?.id, skills[1]?.id]);

    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => fading.has(item.skillId))).toBe(true);

    await expect(addRefreshPracticeBlock({ goalId: goal.id, input })).resolves.toMatchObject({
      block: { id: blockId },
      status: "ready",
    });
  });

  it("also practices a skill due later today, so Content's review count always has something to open", async () => {
    const { goal, skills, user } = await setup();
    const input = { timeZone: "UTC" };
    const dueLater = skills[2]?.id ?? "";

    // Nothing fading; one fresh skill comes due this evening (still today in UTC).
    await prisma.learnerSkill.updateMany({
      data: { due: daysAgo(-10), lastReviewedAt: SESSION_NOW, stability: 30 },
      where: { userId: user.id },
    });

    await prisma.learnerSkill.updateMany({
      data: { due: new Date(SESSION_NOW.getTime() + 6 * 3_600_000) },
      where: { skillId: dueLater, userId: user.id },
    });

    // Today's session is done, so the practice can't be today's reviews block.
    const today = await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });
    const sessionId = today.status === "ready" ? today.session.id : "";

    // A question today's session hasn't asked yet, so the bonus practice has one to ask.
    await Promise.all([
      prisma.studySessionBlock.updateMany({ data: { status: "completed" }, where: { sessionId } }),
      itemFixture({ content: choiceItemContent(), skillId: dueLater }),
    ]);

    const result = await addRefreshPracticeBlock({ goalId: goal.id, input });

    expect(result).toMatchObject({ block: { extra: true, kind: "practice" }, status: "ready" });

    const blockId = result.status === "ready" ? result.block.id : "";
    const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });

    const items = await prisma.item.findMany({
      where: { id: { in: readBlockPayload(block).itemIds } },
    });

    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.skillId === dueLater)).toBe(true);
  });

  it("has nothing to do when nothing is fading or due today", async () => {
    const { goal, user } = await setup();

    await prisma.learnerSkill.updateMany({
      data: { due: daysAgo(-10), lastReviewedAt: SESSION_NOW, stability: 30 },
      where: { userId: user.id },
    });

    await expect(
      addRefreshPracticeBlock({ goalId: goal.id, input: { timeZone: "UTC" } }),
    ).resolves.toStrictEqual({ status: "nothingToPractice" });
  });
});
