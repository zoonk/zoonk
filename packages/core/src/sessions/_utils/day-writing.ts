import { listPracticeWritingTasks } from "../../exams/essays/_utils/practice-writing-tasks";
import { getWritingSkillIds } from "../../learner/writing-skills";
import { getPlanCalendar, toIsoDate } from "../../plans/planner/plan-calendar";
import { getScheduledWrittenTest } from "../../plans/planner/plan-days";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { type PlannedCheckpoint, type PlannedLesson } from "../session-builder";
import { type loadDayPlan } from "./day-plan";
import { type SessionDayContext } from "./session-placement";
import { pickWritingDrill, reserveWritingDrill } from "./writing-drills";

export function getDayWriting({
  context: { blueprint, goal, localDate },
  includesMockExams,
  plan,
}: {
  context: SessionDayContext;
  includesMockExams: boolean;
  plan: Awaited<ReturnType<typeof loadDayPlan>>;
}) {
  const settings = parsePlanSettings(plan.settings);
  const date = toIsoDate(localDate);
  const schedule = settings.writingSchedule;
  const allocated = schedule?.find((entry) => entry.date === date);

  const scheduledWriting = schedule
    ? allocated?.test && { ...allocated.test, minutes: allocated.minutes }
    : getScheduledWrittenTest({
        calendar: getPlanCalendar({ dailyMinutes: goal.dailyMinutes, settings }),
        excludes: new Set(
          plan.items.flatMap(({ kind, scheduledFor }) =>
            kind === "mock" && scheduledFor ? [toIsoDate(scheduledFor)] : [],
          ),
        ),
        planStart: plan.planStart,
        structure: plan.structure,
        targetDate: goal.targetDate,
        today: localDate,
      });

  const tasks = plan.structure
    ? listPracticeWritingTasks({
        classTest: Boolean(blueprint?.ownerId),
        structure: plan.structure,
      }).map((task) => ({
        skillIds: getWritingSkillIds({
          graph: plan.graph,
          section: task.section,
          structure: plan.structure,
        }),
        taskKey: task.key,
        title: task.description,
      }))
    : [];

  const writtenTest: PlannedCheckpoint | null =
    scheduledWriting && includesMockExams
      ? {
          itemIds: [],
          kind: "weekly",
          minutes: scheduledWriting.minutes,
          mock: true,
          mockIdentity: { day: scheduledWriting.day, fullLength: false },
          passMark: 0,
          phase: null,
          planItemId: null,
          rematch: false,
          skillIds: [],
          timeLimitMinutes: scheduledWriting.minutes,
          title: scheduledWriting.title,
          written: true,
        }
      : null;

  return {
    continuingWritingMinutes: allocated?.tasks.length === 0 ? allocated.minutes : 0,
    produces: schedule ? (allocated?.tasks ?? []) : undefined,
    reserveDrill: (lesson: PlannedLesson) =>
      reserveWritingDrill(lesson, pickWritingDrill({ lesson, tasks })),
    scheduledWriting,
    writtenTest,
  };
}
