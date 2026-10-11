import { type PlanOperation } from "../../plan-contract";
import { addDays, fromIsoDate, toIsoDate } from "../../planner/plan-calendar";
import { type PlanState } from "../../planner/plan-state";
import { type SimOperationSpec } from "./sim-life-plan";

type OperationContext = {
  areaAt: (index: number) => string;
  /** The plan's bases (`computePlan().bases.bases`), read only for a change of bases. */
  listBases: () => readonly { skillId: string }[];
  state: PlanState;
  today: Date;
};

function toFocus({ areaAt }: OperationContext, spec: Extract<SimOperationSpec, { kind: "focus" }>) {
  const focused = areaAt(spec.area);
  const less = spec.less === undefined ? null : areaAt(spec.less);
  const also = (spec.also ?? []).map((index) => areaAt(index)).filter((area) => area !== focused);

  return [
    { areas: [focused, ...new Set(also)], kind: "focusAreas" as const },
    ...(less && less !== focused ? [{ areas: [less], kind: "reduceAreas" as const }] : []),
  ];
}

function toDate({ state }: OperationContext, spec: Extract<SimOperationSpec, { kind: "date" }>) {
  const current = state.goal.targetDate;

  return current
    ? [
        {
          kind: "setTargetDate" as const,
          targetDate: toIsoDate(addDays(fromIsoDate(current), spec.days)),
        },
      ]
    : null;
}

function toBases(
  { listBases }: OperationContext,
  spec: Extract<SimOperationSpec, { kind: "bases" }>,
) {
  const bases = listBases();
  const base = bases[spec.base % Math.max(1, bases.length)];

  return base
    ? [
        {
          choices: [{ choice: spec.choice, skillId: base.skillId }],
          kind: "setBaseChoices" as const,
        },
      ]
    : null;
}

/** A change's operations on the plan as it is now, or null when it makes no sense for it. */
export function toOperations({
  areas,
  goalKind,
  spec,
  ...rest
}: Omit<OperationContext, "areaAt"> & {
  areas: readonly string[];
  goalKind: string;
  spec: SimOperationSpec;
}): PlanOperation[] | null {
  const context = {
    ...rest,
    areaAt: (index: number) => areas[index % Math.max(1, areas.length)] ?? "",
  };

  const area = "area" in spec ? [context.areaAt(spec.area)] : [];

  switch (spec.kind) {
    case "focus":
      return toFocus(context, spec);
    case "reduce":
      return [{ areas: area, kind: "reduceAreas" }];
    case "time":
      return [{ kind: "setDailyMinutes", minutes: spec.minutes }];
    case "date":
      return toDate(context, spec);
    case "restDay":
      return [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [spec.weekday] }];
    case "lightWeek":
      return [{ kind: "addLightWeek", startDate: toIsoDate(addDays(context.today, spec.inDays)) }];
    case "bases":
      return toBases(context, spec);
    case "fullCourse":
      return goalKind === "exam" ? [{ fullCourse: spec.on, kind: "setFullCourse" }] : null;
    case "skip":
      return [{ areas: area, kind: "skipAreas" }];
    case "restore":
      return [{ areas: area, kind: "restoreAreas" }];
    case "pastBasics":
      return [{ areas: area, kind: "setAreaStart", start: "pastBasics" }];
    case "practice":
      return [{ bias: spec.bias, kind: "setPracticeBias" }];
    default:
      return spec satisfies never;
  }
}
