import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { mockSession } from "../../_test-utils/mock-session";
import { getPlanTabView } from "../../view-models/plan/get-plan-view";
import { loadPaceSamples } from "../_utils/pace-samples";
import { createGoalPlan } from "../create-goal-plan";
import { choosePace } from "../planner/plan-pace";
import { parsePlanSettings } from "../planner/plan-state";
import { refreshGoalPlan } from "../refresh-goal-plan";
import { planLibraryFixture, unplannedGoalFixture } from "./plan-library";

/** A Tuesday in 2020, before the learning events other tests write, which estimates read. */
export const AHEAD_START = new Date("2020-09-29T12:00:00Z");

const DAY_MS = 86_400_000;

const PHASES = 4;
const SKILLS_PER_PHASE = 3;

export async function readPlanScreen() {
  const result = await getPlanTabView();
  return result.status === "ready" ? result.view.plan : null;
}

export async function studyFaster({ planId, userId }: { planId: string; userId: string }) {
  const items = await prisma.planItem.findMany({
    where: { kind: "lesson", lessonId: { not: null }, planId },
  });

  await Promise.all(
    items.map((item) =>
      learningEventFixture({
        contentIds: { lessonId: item.lessonId },
        endedAt: new Date("2001-01-01T12:00:00Z"),
        seconds: 60,
        userId,
      }),
    ),
  );
}

async function saveSampledPace({
  lessonIds,
  planId,
  userId,
}: {
  lessonIds: string[];
  planId: string;
  userId: string;
}) {
  const pace = choosePace(await loadPaceSamples({ lessonIds, now: new Date(), userId }));
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });

  await prisma.plan.update({
    data: { settings: { ...parsePlanSettings(plan.settings), pace } },
    where: { id: planId },
  });
}

/** Run at `AHEAD_START`. */
export async function aheadPlanFixture({
  dailyMinutes,
  days = 7,
  faster = false,
}: {
  dailyMinutes: number;
  days?: number;
  faster?: boolean;
}) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: Array.from({ length: PHASES }, (_, index) => `Phase ${index + 1}`),
    skills: Array.from({ length: PHASES * SKILLS_PER_PHASE }, (_, index) => ({
      area: "Stocks",
      lessons: 4,
      phase: Math.floor(index / SKILLS_PER_PHASE),
      size: 1,
    })),
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes,
    details: { placementDeclined: true },
    kind: "learn",
    settings: { startDate: "2020-09-29" },
    targetDate: new Date(Date.parse("2020-09-29T00:00:00Z") + days * DAY_MS),
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  if (faster) {
    await studyFaster({ planId: plan.id, userId: user.id });

    await saveSampledPace({
      lessonIds: library.lessons.map((lesson) => lesson.id),
      planId: plan.id,
      userId: user.id,
    });
  }

  await prisma.planItem.updateMany({
    data: { completedAt: AHEAD_START, status: "done" },
    where: { kind: { in: ["chapter", "lesson"] }, planId: plan.id, status: "todo" },
  });

  await refreshGoalPlan({ goalId: goal.id });

  return { goal, library, plan, user };
}
