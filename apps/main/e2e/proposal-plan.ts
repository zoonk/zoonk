import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import {
  getWeeklyMockMinutes,
  listMockClocks,
} from "../../../packages/core/src/exams/mocks/mock-plan";
import { buildPlan } from "../../../packages/core/src/plans/planner/build-plan";
import {
  type PlanGraph,
  parsePlanSettings,
} from "../../../packages/core/src/plans/planner/plan-state";

/** How many days away an exam plan's date is, unless a test sets it. */
const EXAM_DAYS = 190;

/** Real Library content and a saved planner schedule, so proposed changes can be dry-run. */
export async function createProposalPlan({
  dailyMinutes = 30,
  exam = false,
  examDays = EXAM_DAYS,
  lessonMinutes = 3,
  specs,
  startDate,
  startDaysAgo = 10,
}: {
  dailyMinutes?: number;
  exam?: boolean;
  examDays?: number;
  lessonMinutes?: number;
  specs: {
    area: string;
    lessons: number;
    name: string;
    phase?: number;
    topics?: string[];
    written?: string[];
  }[];
  startDate?: Date;
  startDaysAgo?: number;
}) {
  const user = await createE2EUser(getBaseURL());
  const today = toUTCMidnight(new Date());
  const start = startDate ?? (exam ? new Date(today.getTime() - startDaysAgo * MS_PER_DAY) : today);

  const goal = await goalFixture({
    ...(startDate && { createdAt: startDate }),
    dailyMinutes,
    kind: exam ? "exam" : "learn",
    targetDate: exam ? new Date(today.getTime() + examDays * MS_PER_DAY) : null,
    timezone: "UTC",
    userId: user.id,
  });

  const skills = await Promise.all(specs.map((spec) => skillFixture({ name: spec.name })));

  const lessons = await Promise.all(
    specs.flatMap((spec, skillIndex) =>
      (spec.written ?? []).map(async (title) => {
        const lesson = await libraryLessonFixture({ estimatedMinutes: lessonMinutes, title });
        const skillId = skills[skillIndex]?.id ?? "";
        await prisma.lessonSkill.create({ data: { lessonId: lesson.id, skillId } });

        return {
          chapterId: null,
          lessonId: lesson.id,
          minutes: lessonMinutes,
          skillIds: [skillId],
          title,
        };
      }),
    ),
  );

  const graph: PlanGraph = {
    phases: [
      { milestone: null, name: "First interviews" },
      { milestone: null, name: "Practice" },
    ],
    skills: specs.map((spec, index) => ({
      area: spec.area,
      lessons: spec.lessons,
      name: spec.name,
      phase: spec.phase ?? 0,
      skillId: skills[index]?.id ?? "",
      topics: spec.topics,
      weight: null,
    })),
  };

  // Keep the fixture's built pace, as a real plan does, rather than sampling concurrent learners.
  const pace = { factor: 1, source: "typical" as const };
  const settings = parsePlanSettings({ pace, startDate: start.toISOString().slice(0, 10) });

  const built = buildPlan({
    fullMockMinutes: getWeeklyMockMinutes({ fullLength: true, structure: null }),
    goal,
    graph,
    items: [],
    lessons,
    mockClocks: listMockClocks(null),
    mockMinutes: getWeeklyMockMinutes({ fullLength: false, structure: null }),
    mode: "forced",
    paceFactor: pace.factor,
    prerequisites: new Map(),
    readiness: new Map(),
    settings,
    today: start,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph,
    phases: built.phases,
    settings: { ...settings, mockFunding: built.mockFunding },
  });

  await Promise.all([
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    prisma.planItem.createMany({
      data: built.items.map((item, position) => ({
        chapterId: item.chapterId,
        completedAt: item.completedAt,
        kind: item.kind,
        lessonId: item.lessonId,
        lessons: item.lessons,
        phase: item.phase,
        planId: plan.id,
        position,
        scheduledFor: item.scheduledFor,
        skillId: item.skillId,
        status: item.status,
        titleSnapshot: item.titleSnapshot,
      })),
    }),
  ]);

  return { built, plan, today, user };
}
