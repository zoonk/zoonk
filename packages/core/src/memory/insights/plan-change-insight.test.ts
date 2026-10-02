import { type ExtractedMemoryFact, extractMemoryFacts } from "@zoonk/ai/tasks/v2/memory/extraction";
import { generateMemoryInsight } from "@zoonk/ai/tasks/v2/memory/insight";
import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { skillFixture, skillPrerequisiteFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../../_test-utils/deferred-work";
import { mockSession } from "../../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../../plans/_test-utils/plan-library";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { scheduleMemoryAfterSession } from "../after-session";
import { respondToMemoryInsight } from "./respond-to-memory-insight";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

// Extraction and the coach are paid model calls; their behavior is covered by their evals.
vi.mock("@zoonk/ai/tasks/v2/memory/extraction", () => ({ extractMemoryFacts: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/memory/insight", () => ({ generateMemoryInsight: vi.fn() }));

const DAY_MS = 86_400_000;
const NO_FACTS: ExtractedMemoryFact[] = [];
const ANSWERS_PER_DAY = 7;

const PROVENANCE = {
  generatedAt: "2026-09-26T12:00:00.000Z",
  model: "openai/gpt-6-luna",
  promptVersion: "memory-insight-test",
  runId: "run-insight-plan-test",
};

const MESSAGE =
  "You get percentages right until fractions show up. A 3-minute lesson on turning fractions into percentages should help.";

/**
 * A learner whose plan teaches two skills, who keeps missing the second one, and a prerequisite of
 * it the plan doesn't teach: the lesson a plan-change insight can add.
 */
async function setup() {
  const [user, library, prerequisite] = await Promise.all([
    userFixture(),
    planLibraryFixture({ skills: [{ lessons: 2 }, { lessons: 2 }] }),
    skillFixture({ name: "Fractions as percentages" }),
  ]);

  const weak = library.skills[1];

  const [{ goal, plan }] = await Promise.all([
    unplannedGoalFixture({ dailyMinutes: 20, language: "en", userId: user.id }),
    learningProfileFixture({ birthMonth: 5, birthYear: 1990, userId: user.id }),
    skillPrerequisiteFixture({ prerequisiteId: prerequisite.id, skillId: weak?.id ?? "" }),
  ]);

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  // Noon UTC keeps every answer of a day on that day, whenever the test runs.
  const todayNoon = new Date().setUTCHours(12, 0, 0, 0);

  await Promise.all(
    Array.from({ length: 2 * ANSWERS_PER_DAY }, (_, index) =>
      attemptFixture({
        answeredAt: new Date(todayNoon - Math.floor(index / ANSWERS_PER_DAY) * DAY_MS - index),
        isCorrect: index % 2 === 0,
        skillId: weak?.id,
        userId: user.id,
      }),
    ),
  );

  vi.mocked(extractMemoryFacts).mockResolvedValue({
    data: { facts: NO_FACTS },
    provenance: PROVENANCE,
  } as Awaited<ReturnType<typeof extractMemoryFacts>>);

  vi.mocked(generateMemoryInsight).mockResolvedValue({
    data: {
      kind: "planChange",
      lessonFocus: "Turning fractions into percentages",
      message: MESSAGE,
      skill: 1,
      studyTime: null,
    },
    provenance: PROVENANCE,
  } as Awaited<ReturnType<typeof generateMemoryInsight>>);

  return { goal, plan, prerequisite, user, weak };
}

function planSkillIds(planId: string) {
  return prisma.planItem
    .findMany({ select: { skillId: true }, where: { planId } })
    .then((items) => items.map((item) => item.skillId));
}

/** The session ends and memory reads it after the response, which the test waits for. */
async function endSession({ goalId, userId }: { goalId: string; userId: string }) {
  const settle = runDeferredWork();
  scheduleMemoryAfterSession({ goalId, sessionId: null, timeZone: "UTC", userId });
  await settle();
}

describe("plan-change insights", () => {
  it("adds a missing prerequisite through the planner, and dismissing undoes it", async () => {
    const { goal, plan, prerequisite, user, weak } = await setup();

    await endSession({ goalId: goal.id, userId: user.id });

    expect(generateMemoryInsight).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        kinds: ["tip", "planChange", "scheduleIdea"],
        skills: [
          {
            chapter: null,
            covers: ["Fractions as percentages"],
            lessons: 1,
            name: "Fractions as percentages",
            prepares: weak?.name,
          },
        ],
      }),
    );

    const insight = await prisma.memoryInsight.findFirstOrThrow({ where: { userId: user.id } });

    expect(insight).toMatchObject({ kind: "planChange", message: MESSAGE });

    expect(insight.payload).toMatchObject({
      planChangeStatus: "applied",
      skillId: prerequisite.id,
    });

    await expect(planSkillIds(plan.id)).resolves.toContain(prerequisite.id);

    const change = await prisma.planChange.findFirstOrThrow({
      where: { planId: plan.id, reason: MESSAGE },
    });

    expect(change.status).toBe("applied");

    mockSession(user.id);

    const answer = await respondToMemoryInsight({
      input: { status: "dismissed" },
      insightId: insight.id,
    });

    expect(answer).toMatchObject({
      insight: { planChange: { id: change.id, status: "applied" }, status: "dismissed" },
      status: "updated",
    });

    await expect(planSkillIds(plan.id)).resolves.not.toContain(prerequisite.id);
  });

  it("offers no plan change when the plan already teaches every prerequisite", async () => {
    const { goal, prerequisite, user } = await setup();

    await prisma.skillPrerequisite.deleteMany({ where: { prerequisiteId: prerequisite.id } });

    await endSession({ goalId: goal.id, userId: user.id });

    expect(generateMemoryInsight).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ kinds: ["tip", "scheduleIdea"], skills: [] }),
    );

    const insight = await prisma.memoryInsight.findFirstOrThrow({ where: { userId: user.id } });
    expect(insight).toMatchObject({ kind: null, message: null });
  });
});
