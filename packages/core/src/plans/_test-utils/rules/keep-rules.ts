import { getWrittenTestAreas } from "../../planner/graph-areas";
import { addDays, daysBetween, fromIsoDate } from "../../planner/plan-calendar";
import { type RuleContext, type RuleItem, type RulePlan, type RuleViolation } from "./rule-context";
import { findFirstDue, getAreaOf, isTodoLesson, toDay } from "./rule-items";

/** A written test starts in the plan's first week. */
const FIRST_WEEK_DAYS = 7;

/** A test this close is planned day by day, whose days all fall in the first week anyway. */
const FAR_ENOUGH_DAYS = 14;

/**
 * R12. An exam's written tests (an essay, a discursive test) are always in the plan, and a new
 * plan practices them from its first week when practice is weekly (the default) and the exam is
 * more than two weeks away. Areas the learner took out are left out.
 */
export function checkWrittenTestsKept(context: RuleContext): RuleViolation[] {
  const { after, event, today } = context;

  if (after.goal.kind !== "exam") {
    return [];
  }

  const areaOf = getAreaOf(after.graph);
  const start = after.settings.startDate ? fromIsoDate(after.settings.startDate) : today;
  const firstWeekEnd = addDays(start, FIRST_WEEK_DAYS);
  const { targetDate } = after.goal;
  const farEnough = targetDate === null || daysBetween(start, targetDate) > FAR_ENOUGH_DAYS;

  const checksFirstWeek =
    event.kind === "planCreated" && after.settings.writtenCadence === "weekly" && farEnough;

  return [...getWrittenTestAreas(after.graph)]
    .filter((area) => !after.settings.skippedAreas.includes(area))
    .flatMap((area) => {
      const own = after.items.filter(
        (item) => item.kind === "lesson" && areaOf(item.skillId) === area,
      );

      const first = findFirstDue(own.filter((item) => isTodoLesson(item)));
      const late = checksFirstWeek && (first === null || first >= firstWeekEnd.getTime());

      if (own.length === 0) {
        return [
          {
            details: { area },
            message: `The written test ${area} is out of the plan.`,
            rule: "R12",
          },
        ];
      }

      return late
        ? [
            {
              details: { area, first: toDay(first) },
              message: `The written test ${area} doesn't start in the plan's first week.`,
              rule: "R12",
            },
          ]
        : [];
    });
}

/**
 * The skills the lessons the learner finished teach, whichever skill each one's item counts it for.
 * A language unit's rent lesson, counted for another skill, also taught asking the rent, which
 * booking a visit builds on.
 */
function listStudiedSkills(plan: RulePlan): Set<string> {
  return new Set(
    plan.items.flatMap((item) =>
      item.kind === "lesson" && item.status === "done" && item.lessonId
        ? (plan.taughtBy?.get(item.lessonId) ?? [])
        : [],
    ),
  );
}

/** A skill's lessons, and whether the learner began any of them or studied it in another's. */
function readSkill({
  items,
  skillId,
  studied,
}: {
  items: readonly RuleItem[];
  skillId: string;
  studied: ReadonlySet<string>;
}) {
  const own = items.filter((item) => item.kind === "lesson" && item.skillId === skillId);

  return {
    first: findFirstDue(own.filter((item) => isTodoLesson(item))),
    started: studied.has(skillId) || own.some((item) => item.status !== "todo"),
  };
}

/**
 * R16. What a skill builds on comes first: for two skills neither of which the learner began
 * (a lesson they finished teaches it, see `listStudiedSkills`), a prerequisite with lessons in the
 * plan has its first one due no later than the first lesson of the skill built on it.
 */
export function checkPrerequisitesFirst(context: RuleContext): RuleViolation[] {
  const { after } = context;
  const { prerequisites } = after;

  if (!prerequisites) {
    return [];
  }

  const studied = listStudiedSkills(after);

  return after.graph.skills.flatMap((skill) => {
    const own = readSkill({ items: after.items, skillId: skill.skillId, studied });

    if (own.first === null || own.started) {
      return [];
    }

    return (prerequisites.get(skill.skillId) ?? []).flatMap((baseId) => {
      const base = readSkill({ items: after.items, skillId: baseId, studied });
      const late = base.first !== null && !base.started && base.first > (own.first ?? 0);

      return late
        ? [
            {
              details: {
                base: baseId,
                baseFirst: toDay(base.first),
                skill: skill.skillId,
                skillFirst: toDay(own.first),
              },
              message: "A skill comes before what it builds on.",
              rule: "R16",
            },
          ]
        : [];
    });
  });
}
