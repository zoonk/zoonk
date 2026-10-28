import { type PlanOperation } from "../../plan-contract";
import { daysBetween } from "../../planner/plan-calendar";
import { type RuleContext, type RuleItem, type RulePlan, type RuleViolation } from "./rule-context";
import { getAreaOf, getRuleItemKey, isDueOn, isTodoLesson } from "./rule-items";

const REVIEW_DAYS = 7;

type FocusTarget = { area: string; name: string; skillIds: ReadonlySet<string> };

function isSteeringOnly(operations: readonly PlanOperation[]): boolean {
  return (
    operations.length > 0 &&
    operations.every(
      (operation) => operation.kind === "focusAreas" || operation.kind === "reduceAreas",
    )
  );
}

function hasReviewAhead({ after, today }: Pick<RuleContext, "after" | "today">): boolean {
  const { kind, targetDate } = after.goal;
  return kind === "exam" && targetDate !== null && daysBetween(today, targetDate) <= REVIEW_DAYS;
}

function getSteering(context: RuleContext): readonly PlanOperation[] | null {
  const { before, event } = context;

  if (!before || event.kind !== "learnerChange" || !isSteeringOnly(event.operations)) {
    return null;
  }

  return hasReviewAhead(context) ? null : event.operations;
}

function listAreaSkills({ area, plan }: { area: string; plan: RulePlan }): Set<string> {
  const areaOf = getAreaOf(plan.graph);

  return new Set(
    plan.graph.skills.flatMap((skill) => (areaOf(skill.skillId) === area ? skill.skillId : [])),
  );
}

function listFocusTargets({
  operations,
  plan,
}: {
  operations: readonly PlanOperation[];
  plan: RulePlan;
}): FocusTarget[] {
  return operations.flatMap((operation) => {
    if (operation.kind !== "focusAreas") {
      return [];
    }

    return operation.areas.map((area) => {
      const part =
        operation.parts?.find((entry) => entry.area === area) ??
        plan.settings.focusParts.find((entry) => entry.area === area);

      return part
        ? { area, name: part.name, skillIds: new Set(part.skillIds) }
        : { area, name: area, skillIds: listAreaSkills({ area, plan }) };
    });
  });
}

function listReducedAreas(operations: readonly PlanOperation[]): string[] {
  return operations.flatMap((operation) =>
    operation.kind === "reduceAreas" ? operation.areas : [],
  );
}

function listTodayLessons({ day, items }: { day: Date; items: readonly RuleItem[] }) {
  return items.filter((item) => isTodoLesson(item) && isDueOn({ day, item }));
}

function toKeys(items: readonly RuleItem[]): string[] {
  return items.map((item) => getRuleItemKey(item));
}

export function checkSteeringKeepsToday(context: RuleContext): RuleViolation[] {
  const operations = getSteering(context);
  const { after, before, today, todayShown } = context;

  if (!operations || !before || !todayShown) {
    return [];
  }

  const areaOf = getAreaOf(after.graph);
  const reduced = new Set(listReducedAreas(operations));
  const focused = listFocusTargets({ operations, plan: after });
  const was = listTodayLessons({ day: today, items: before.items });
  const now = listTodayLessons({ day: today, items: after.items });
  const nowKeys = toKeys(now);
  const kept = toKeys(was.filter((item) => !reduced.has(areaOf(item.skillId) ?? "")));
  const wasKeys = new Set(toKeys(was));
  const lastKept = nowKeys.findLastIndex((key) => kept.includes(key));

  const came = now.filter((item) => !wasKeys.has(getRuleItemKey(item)));

  const mayComeIn = (item: RuleItem) =>
    focused.length > 0
      ? focused.some((target) => target.skillIds.has(item.skillId ?? ""))
      : !reduced.has(areaOf(item.skillId) ?? "");

  const inOrder =
    nowKeys.filter((key) => kept.includes(key)).join(",") ===
    kept.filter((key) => nowKeys.includes(key)).join(",");

  const problems = [
    ...kept
      .filter((key) => !nowKeys.includes(key))
      .map((lesson) => ({ lesson, problem: "left today" })),
    ...(inOrder ? [] : [{ lesson: null, problem: "reordered" }]),
    ...came
      .filter((item) => !mayComeIn(item))
      .map((item) => ({
        lesson: item.titleSnapshot,
        problem: `came in from ${areaOf(item.skillId) ?? "an unnamed area"}`,
      })),
    ...came
      .filter((item) => mayComeIn(item) && now.indexOf(item) < lastKept)
      .map((item) => ({ lesson: item.titleSnapshot, problem: "came in before today's lessons" })),
  ];

  return problems.map((details) => ({
    details,
    message: "A change of focus changed today's session beyond what it asked.",
    rule: "R4",
  }));
}
