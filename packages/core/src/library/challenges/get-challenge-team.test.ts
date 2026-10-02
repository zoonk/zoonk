import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { buildChallengeTeam } from "./challenge-team";
import { getChallengeTeam } from "./get-challenge-team";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

async function learnerWithPlan({ language = "pt" }: { language?: string } = {}) {
  const [user, lesson] = await Promise.all([userFixture(), libraryLessonFixture({ language })]);
  const goal = await goalFixture({ userId: user.id });

  const plan = await planFixture({
    goalId: goal.id,
    settings: { focusAreas: ["Statistics"], weekdayMinutes: null },
  });

  await planItemFixture({ lessonId: lesson.id, planId: plan.id });
  mockSession(user.id);

  return { goal, lesson, plan, user };
}

describe(getChallengeTeam, () => {
  it("picks the plan's team from names in the lesson's language and keeps it with the plan", async () => {
    const { lesson, plan } = await learnerWithPlan();

    const outcome = await getChallengeTeam({ lessonId: lesson.id });
    const team = buildChallengeTeam({ language: "pt", seed: plan.id });

    expect(outcome).toStrictEqual({ status: "ready", team });

    const stored = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const settings = parsePlanSettings(stored.settings);

    expect(settings.team).toStrictEqual(team);
    expect(settings.focusAreas).toStrictEqual(["Statistics"]);
  });

  it("keeps the same team for every challenge of the plan", async () => {
    const { lesson, plan } = await learnerWithPlan();
    const kept = { language: "pt", members: [{ name: "Ana" }, { name: "Rui" }] };

    await prisma.plan.update({ data: { settings: { team: kept } }, where: { id: plan.id } });

    const other = await libraryLessonFixture({ language: "en" });
    await planItemFixture({ lessonId: other.id, planId: plan.id });

    await expect(getChallengeTeam({ lessonId: lesson.id })).resolves.toStrictEqual({
      status: "ready",
      team: kept,
    });

    await expect(getChallengeTeam({ lessonId: other.id })).resolves.toStrictEqual({
      status: "ready",
      team: kept,
    });
  });

  it("uses the active goal's plan for a lesson played outside it", async () => {
    const { plan, user } = await learnerWithPlan();
    const outside = await libraryLessonFixture({ language: "en" });

    await prisma.userLearningProfile.create({
      data: { activeGoalId: plan.goalId, userId: user.id },
    });

    await expect(getChallengeTeam({ lessonId: outside.id })).resolves.toStrictEqual({
      status: "ready",
      team: buildChallengeTeam({ language: "en", seed: plan.id }),
    });
  });

  it("gives a learner without a plan the same team every time, without storing it", async () => {
    const [user, lesson] = await Promise.all([userFixture(), libraryLessonFixture()]);
    mockSession(user.id);

    const expected = {
      status: "ready",
      team: buildChallengeTeam({ language: lesson.language, seed: user.id }),
    };

    await expect(getChallengeTeam({ lessonId: lesson.id })).resolves.toStrictEqual(expected);
    await expect(getChallengeTeam({ lessonId: lesson.id })).resolves.toStrictEqual(expected);
  });

  it("has no team for a visitor, a missing lesson or someone else's private lesson", async () => {
    const [owner, user] = await Promise.all([userFixture(), userFixture()]);
    const hidden = await libraryLessonFixture({ ownerId: owner.id, visibility: "private" });

    mockSession(null);

    await expect(getChallengeTeam({ lessonId: hidden.id })).resolves.toStrictEqual({
      status: "unauthorized",
    });

    mockSession(user.id);

    await expect(getChallengeTeam({ lessonId: hidden.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(getChallengeTeam({ lessonId: "not-a-lesson" })).resolves.toStrictEqual({
      status: "notFound",
    });
  });
});
