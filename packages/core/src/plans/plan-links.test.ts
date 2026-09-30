import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { getPlanLink } from "./get-plan-link";
import { startGoalFromPlanLink } from "./start-goal-from-plan-link";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

/**
 * A Monday in 2020, before the learning events other tests write: estimates read everyone's recent
 * pace, and this keeps it out of the dates these tests expect.
 */
const NOW = new Date("2020-09-28T12:00:00Z");

/** An owner's plan with one private skill made for their own goal, in its own phase. */
async function setup() {
  const [owner, course] = await Promise.all([
    userFixture(),
    courseFixture({ description: "How markets set prices", title: "How the stock market works" }),
  ]);

  const library = await planLibraryFixture({
    phases: ["Basics", "Advanced"],
    skills: [{ lessons: 2 }, { lessons: 1, phase: 1 }],
  });

  const secret = await skillFixture({
    name: "My company's budget review",
    ownerId: owner.id,
    visibility: "private",
  });

  const { goal, plan } = await unplannedGoalFixture({
    primaryCourseId: course.id,
    prompt: "I need this for my job at Acme before my review",
    title: "Markets for my Acme review",
    userId: owner.id,
  });

  const graph = {
    phases: [...library.graph.phases, { milestone: null, name: "Acme review" }],
    skills: [
      ...library.graph.skills,
      { area: null, lessons: 2, name: secret.name, phase: 2, skillId: secret.id, weight: null },
    ],
  };

  await createGoalPlan({ goalId: goal.id, graph });

  return { course, goal, library, owner, plan, secret };
}

describe("plan links", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows anyone the subject and the plan's shape, never the owner's goal or private skills", async () => {
    const { plan, secret } = await setup();
    mockSession(null);

    const link = await getPlanLink(plan.id);

    expect(link).toStrictEqual({
      outline: {
        goalKind: "learn",
        hours: 0.3,
        language: "en",
        phases: [
          { hours: 0.2, milestone: "Can do Basics", name: "Basics" },
          { hours: 0.1, milestone: "Can do Advanced", name: "Advanced" },
        ],
        skillCount: 2,
        subject: { description: "How markets set prices", title: "How the stock market works" },
        targetLanguage: null,
      },
      owner: null,
      status: "ready",
    });

    const text = JSON.stringify(link);
    expect(text).not.toContain("Acme");
    expect(text).not.toContain(secret.id);
  });

  it("tells the owner the link is theirs", async () => {
    const { goal, owner, plan } = await setup();
    mockSession(owner.id);

    await expect(getPlanLink(plan.id)).resolves.toMatchObject({
      owner: { goalId: goal.id },
      status: "ready",
    });

    await expect(getPlanLink("not-a-plan")).resolves.toStrictEqual({ status: "notFound" });
  });

  it("starts the visitor's own goal from the plan's public structure", async () => {
    const { course, library, plan, secret } = await setup();
    const visitor = await userFixture();
    mockSession(visitor.id);

    const result = await startGoalFromPlanLink({
      input: { dailyMinutes: 20, timeZone: "UTC" },
      planId: plan.id,
    });

    expect(result).toMatchObject({
      goal: {
        dailyMinutes: 20,
        isActive: true,
        kind: "learn",
        primaryCourseId: course.id,
        title: "How the stock market works",
      },
      status: "created",
    });

    const goalId = result.status === "created" ? result.goal.id : "";

    const copy = await prisma.plan.findUniqueOrThrow({
      include: { items: true },
      where: { goalId },
    });

    expect(copy.graph).toMatchObject({ skills: library.graph.skills });
    expect(copy.items.map((item) => item.skillId)).not.toContain(secret.id);
    expect(copy.items.filter((item) => item.kind === "lesson")).toHaveLength(3);

    const own = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
    expect(own).toMatchObject({ prompt: "How the stock market works", userId: visitor.id });
  });

  it("keeps an exam read from the owner's private material to the owner", async () => {
    const { goal, owner, plan } = await setup();

    const exam = await examBlueprintFixture({
      identityKey: `private:${owner.id}:acme-certification`,
      name: "Acme certification",
      ownerId: owner.id,
      visibility: "private",
    });

    await prisma.goal.update({
      data: { examBlueprintId: exam.id, kind: "exam", primaryCourseId: null },
      where: { id: goal.id },
    });

    const visitor = await userFixture();
    mockSession(visitor.id);

    const link = await getPlanLink(plan.id);

    expect(link).toMatchObject({ outline: { goalKind: "exam", subject: null } });
    expect(JSON.stringify(link)).not.toContain("Acme");

    await expect(
      startGoalFromPlanLink({
        input: { dailyMinutes: 20, timeZone: "UTC", title: "Certification" },
        planId: plan.id,
      }),
    ).resolves.toMatchObject({
      goal: { examBlueprintId: null, kind: "exam", title: "Certification" },
      status: "created",
    });
  });

  it("needs a session, and a title when the link has no public subject", async () => {
    const { goal, owner, plan } = await setup();

    mockSession(null);

    await expect(
      startGoalFromPlanLink({ input: { dailyMinutes: 20 }, planId: plan.id }),
    ).resolves.toStrictEqual({ status: "unauthorized" });

    await prisma.goal.update({ data: { primaryCourseId: null }, where: { id: goal.id } });
    const visitor = await userFixture();
    mockSession(visitor.id);

    await expect(
      startGoalFromPlanLink({ input: { dailyMinutes: 20 }, planId: plan.id }),
    ).resolves.toStrictEqual({ status: "titleRequired" });

    mockSession(owner.id);

    await expect(
      startGoalFromPlanLink({ input: { dailyMinutes: 20 }, planId: plan.id }),
    ).resolves.toMatchObject({ goal: { id: goal.id }, status: "owner" });
  });
});
