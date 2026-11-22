import { loadSessionProduce } from "../../exams/essays/_utils/load-produce";
import { listPracticeWritingTasks } from "../../exams/essays/_utils/practice-writing-tasks";
import { loadScheduledAnswers } from "../../learner/facts/scheduled-answers";
import { getWritingSkillIds } from "../../learner/writing-skills";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { getPlanCalendar, toIsoDate } from "../../plans/planner/plan-calendar";
import { getScheduledWrittenTest } from "../../plans/planner/plan-days";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { resolveWritingDay } from "../../plans/planner/writing-schedule";
import { type PlannedCheckpoint, type PlannedLesson } from "../session-builder";
import { type loadDayPlan } from "./day-plan";
import { type SessionDayContext } from "./session-placement";
import { pickWritingDrill, reserveWritingDrill } from "./writing-drills";

async function loadLegacyProduces({
  context,
  onDemand,
  planSettings,
}: {
  context: SessionDayContext;
  onDemand: boolean;
  planSettings: unknown;
}) {
  const { blueprint, goal, localDate, readWritingAnswers = loadScheduledAnswers, userId } = context;

  const produce = await loadSessionProduce({
    blueprint,
    goal,
    onDemand,
    planSettings,
    today: localDate,
    userId,
  });

  if (!produce) {
    return [];
  }

  const answers = await readWritingAnswers(userId, goal.id);
  const date = toIsoDate(localDate);
  return answers.some((answer) => answer.date === date) ? [] : [produce];
}

export async function loadDayWriting({
  context,
  includesMockExams,
  plan,
}: {
  context: SessionDayContext;
  includesMockExams: boolean;
  plan: Awaited<ReturnType<typeof loadDayPlan>>;
}) {
  const { blueprint, goal, localDate, readWritingAnswers = loadScheduledAnswers, userId } = context;
  const settings = parsePlanSettings(plan.settings);
  const date = toIsoDate(localDate);
  const schedule = settings.writingSchedule;

  const allocated =
    schedule?.length && plan.dayMinutes > 0
      ? resolveWritingDay({
          attempts: await readWritingAnswers(userId, goal.id),
          schedule,
          today: date,
        })
      : undefined;

  const scheduledWriting = schedule
    ? allocated?.test && { ...allocated.test, minutes: allocated.minutes }
    : getScheduledWrittenTest({
        calendar: getPlanCalendar({ dailyMinutes: goal.dailyMinutes, settings }),
        excludes: new Set(
          plan.items.flatMap(({ kind, scheduledFor }) =>
            kind === "mock" && scheduledFor ? [toIsoDate(scheduledFor)] : [],
          ),
        ),
        picks: settings,
        planStart: plan.planStart,
        structure: blueprint ? readBlueprintContent(blueprint).structure : null,
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

  const taskKeys = new Set(tasks.map(({ taskKey }) => taskKey));

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
    produces: schedule
      ? (allocated?.tasks.filter(({ taskKey }) => taskKeys.has(taskKey)) ?? [])
      : await loadLegacyProduces({
          context,
          onDemand: Boolean(scheduledWriting) && !includesMockExams,
          planSettings: plan.settings,
        }),
    reserveDrill: (lesson: PlannedLesson) =>
      reserveWritingDrill(lesson, pickWritingDrill({ lesson, tasks })),
    writtenTest,
  };
}
