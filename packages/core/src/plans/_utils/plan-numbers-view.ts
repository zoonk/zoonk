import "server-only";
import { prisma } from "@zoonk/db";
import { getOwnLevel } from "../../learner/placement/placement-contract";
import { type PlanNumbers } from "../numbers-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { getItemKey } from "../planner/plan-items";
import { type ShownFeasibility } from "./plan-feasibility-view";
import { getPlanNumbers, getPlanWorkload } from "./plan-numbers";
import { type PlanReadContext } from "./plan-read-projection";
import { type ComputedPlan } from "./replan";
import { readSelectedItemFacts } from "./selected-item-contract";

export async function buildPlanNumbersView({
  computed,
  context,
}: {
  computed: ComputedPlan;
  context: PlanReadContext;
}): Promise<PlanNumbers> {
  const { pace, state } = computed;
  const settings = state.settings;
  const built = computed.built;

  const lessons = await prisma.lesson.findMany({
    select: { estimatedMinutes: true, id: true },
    where: {
      id: {
        in: [
          ...new Set(
            built.items.flatMap((item) => (item.kind === "lesson" ? (item.lessonId ?? []) : [])),
          ),
        ],
      },
    },
  });

  const workload = getPlanWorkload({
    built,
    fromDate: context.today,
    lessonMinutes: new Map(lessons.map((lesson) => [lesson.id, lesson.estimatedMinutes])),
    paceFactor: pace.factor,
  });

  return getPlanNumbers({
    built,
    context: {
      dailyMinutes: state.goal.dailyMinutes,
      fromDate: toIsoDate(context.today),
      fullCourse: context.goal.kind === "exam" && settings.fullCourse,
      ownLevel: getOwnLevel({ goal: context.goal }),
      paceFactor: pace.factor,
      targetDate: state.goal.targetDate,
      weekdayMinutes:
        settings.weekdayMinutes ?? Array.from({ length: 7 }, () => state.goal.dailyMinutes),
    },
    coverage: computed.feasibility,
    isExam: context.goal.kind === "exam",
    settings,
    workload,
  });
}

/** `coverage` is the plan view's own, so both say the same share. */
export function buildSavedPlanNumbersView({
  context,
  coverage,
}: {
  context: PlanReadContext;
  coverage: Pick<ShownFeasibility, "coveredShare" | "fits" | "measure"> | null;
}): PlanNumbers {
  const { state, goal, today } = context;

  const items = context.items.map((item) => ({
    ...item,
    key: getItemKey(item),
    minutes: item.minutes ?? 0,
  }));

  const facts = items
    .filter((item) => item.status === "todo")
    .map((item) => readSelectedItemFacts(item.facts));

  const sum = (part: "checkpoint" | "practice" | "unwritten" | "written") =>
    Math.round(facts.reduce((total, fact) => total + (fact?.parts[part] ?? 0), 0) * 10) / 10;

  return getPlanNumbers({
    built: {
      items,
      lessonDayMinutes: new Map(
        items.flatMap((item) => {
          const days = readSelectedItemFacts(item.facts)?.days;

          return days
            ? [[item.key, new Map(days.map(([date, minutes]) => [date, minutes]))] as const]
            : [];
        }),
      ),
    },
    context: {
      dailyMinutes: state.goal.dailyMinutes,
      fromDate: toIsoDate(today),
      fullCourse: goal.kind === "exam" && state.settings.fullCourse,
      ownLevel: getOwnLevel({ goal }),
      paceFactor: state.settings.pace?.factor ?? 1,
      targetDate: state.goal.targetDate,
      weekdayMinutes:
        state.settings.weekdayMinutes ?? Array.from({ length: 7 }, () => state.goal.dailyMinutes),
    },
    coverage,
    isExam: goal.kind === "exam",
    settings: state.settings,
    workload: {
      checkpointMinutes: sum("checkpoint"),
      lessonMinutes: sum("written"),
      practiceMinutes: sum("practice"),
      unwrittenLessonMinutes: sum("unwritten"),
    },
  });
}
