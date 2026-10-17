import "server-only";
import { prisma } from "@zoonk/db";
import { getOwnLevel } from "../../learner/placement/placement-contract";
import { type PlanNumbers } from "../numbers-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { getItemKey } from "../planner/plan-items";
import { getPlanNumbers, getPlanWorkload } from "./plan-numbers";
import { type PlanReadContext } from "./plan-read-projection";
import { type ComputedPlan } from "./replan";

/** The actual pure build's numbers, also reused for a prospective onboarding schedule. */
export async function buildPlanNumbersView({
  computed,
  context,
  saved = false,
}: {
  computed: ComputedPlan;
  context: PlanReadContext;
  saved?: boolean;
}): Promise<PlanNumbers> {
  const { pace, state } = computed;
  const settings = saved ? context.state.settings : state.settings;
  const byKey = new Map(computed.built.items.map((item) => [item.key, item]));
  /** Plan renders its saved dates and items; only advice describes a prospective schedule. */
  const built = saved
    ? {
        ...computed.built,
        items: context.items.flatMap((item) => {
          const planned = byKey.get(getItemKey(item));

          return planned
            ? [{ ...planned, scheduledFor: item.scheduledFor, status: item.status }]
            : [];
        }),
      }
    : computed.built;

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
