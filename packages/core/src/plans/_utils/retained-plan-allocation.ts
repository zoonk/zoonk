import { type BuildPlanInput, type BuiltPlan } from "../planner/build-plan";
import { fromIsoDate, toIsoDate } from "../planner/plan-calendar";
import { LEARN_KINDS } from "../planner/plan-item-rules";
import { getItemKey } from "../planner/plan-items";
import { type ExamSubjectShare } from "../planner/selected-coverage";
import { summarizeSelectedPlan } from "../planner/selected-plan-summary";
import { type PlanContext } from "./plan-context";
import { readSelectedItemFacts } from "./selected-item-contract";

export function retainPlanAllocation({
  built,
  context,
}: {
  built: BuiltPlan;
  context: Pick<PlanContext, "items" | "phases">;
}): BuiltPlan | null {
  const rows = context.items.map((item) => ({
    facts: readSelectedItemFacts(item.facts),
    item,
    key: getItemKey(item),
  }));

  if (rows.some((row) => row.facts === null)) {
    return null;
  }

  const items = rows.map(({ facts, item, key }) => ({
    ...item,
    key,
    minutes: facts?.minutes ?? 0,
  }));

  const intervals = rows.flatMap(({ facts, item, key }) => {
    if (!LEARN_KINDS.has(item.kind) || !item.scheduledFor || !facts) {
      return [];
    }

    const timed = item.status !== "todo" || built.lessonRawMinutes.has(key);

    const days: [string, number, number][] =
      facts.days ??
      (timed
        ? [
            [
              toIsoDate(item.scheduledFor),
              facts.minutes,
              facts.parts.written + facts.parts.unwritten,
            ],
          ]
        : []);

    return [{ days, end: fromIsoDate(facts.teachingEnd ?? toIsoDate(item.scheduledFor)), key }];
  });

  return {
    ...built,
    estimate: {
      ...built.estimate,
      totalMinutes: Math.round(items.reduce((total, item) => total + item.minutes, 0)),
    },
    items,
    lessonDayMinutes: new Map(
      intervals.map(({ days, key }) => [
        key,
        new Map(days.map(([day, minutes]) => [day, minutes])),
      ]),
    ),
    lessonRawMinutes: new Map(
      intervals.map(({ days, key }) => [key, new Map(days.map(([day, , raw]) => [day, raw]))]),
    ),
    phases: context.phases,
    teachingEnds: new Map(intervals.map(({ end, key }) => [key, end])),
  };
}

export function summarizeRetainedPlan({
  built,
  context,
  examSubjects,
  input,
}: {
  built: BuiltPlan;
  context: Pick<PlanContext, "items" | "phases">;
  examSubjects: readonly ExamSubjectShare[] | null;
  input: BuildPlanInput;
}) {
  const retained = retainPlanAllocation({ built, context });

  return retained ? summarizeSelectedPlan({ built: retained, examSubjects, input }) : null;
}
