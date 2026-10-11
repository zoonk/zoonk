import { type PlanOperation } from "../../plan-contract";
import { listStudiedCores } from "../../planner/chosen-bases";
import { getWrittenTestAreas } from "../../planner/graph-areas";
import { addDays, daysBetween, fromIsoDate } from "../../planner/plan-calendar";
import { type BaseChoice } from "../../planner/plan-state";
import { type RuleContext, type RuleItem, type RulePlan, type RuleViolation } from "./rule-context";
import {
  findFirstDue,
  getAreaOf,
  getSkillTopics,
  isPlanUnchanged,
  isTodoLesson,
  listMissingKeys,
  listOutByChoice,
  listPhaseDatesProposals,
  listPlannedSkills,
  listPlannedTopics,
  toAreaTopicKey,
  toDay,
} from "./rule-items";

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
 * R13. A career goal keeps the work that turns study into its result: every outcome skill (the
 * portfolio, the job search) has lessons in the plan, whatever its time. Areas the learner took
 * out are left out, and so is an outcome skill that only moving the phase dates fits in while
 * Today asks to move them and its card names it (`outcomesAdded`), or after the learner kept their
 * dates over that card.
 */
export function checkOutcomesKept(context: RuleContext): RuleViolation[] {
  const { after } = context;

  if (after.goal.kind === "exam") {
    return [];
  }

  const planned = listPlannedSkills(after.items);
  const out = listOutByChoice(after);

  const offeredBack = new Set(
    listPhaseDatesProposals(context).flatMap((change) => change.effect?.outcomesAdded ?? []),
  );

  return after.graph.skills
    .filter(
      (skill) =>
        skill.outcome &&
        !planned.has(skill.skillId) &&
        !out.has(skill.skillId) &&
        !offeredBack.has(skill.name),
    )
    .map((skill) => ({
      details: { skill: skill.name },
      message: `The outcome skill "${skill.name}" is out of the plan.`,
      rule: "R13",
    }));
}

/**
 * R14. Studying everything leaves nothing out: a plan without a date, or an exam's plan that goes
 * on after the exam, has lessons for every skill of its graph but those the learner took out,
 * skipped as a base or starts past.
 */
export function checkEverythingPlanned(context: RuleContext): RuleViolation[] {
  const { after } = context;

  const everything =
    after.goal.targetDate === null || (after.goal.kind === "exam" && after.settings.fullCourse);

  if (!everything || after.goal.kind === "explain") {
    return [];
  }

  const planned = listPlannedSkills(after.items);
  const out = listOutByChoice(after);

  const missing = after.graph.skills.filter(
    (skill) => !planned.has(skill.skillId) && !out.has(skill.skillId),
  );

  return missing.length > 0
    ? [
        {
          details: { skills: missing.map((skill) => skill.name) },
          message: "A plan that studies everything left skills out.",
          rule: "R14",
        },
      ]
    : [];
}

/** What each base choice costs the plan, cheapest first: its core ("essential") is the default. */
const BASE_CHOICE_COSTS: Readonly<Record<BaseChoice, number>> = {
  deep: 3,
  essential: 2,
  quick: 1,
  skip: 0,
};

/** How many base choices these operations make. */
function countBaseChoices(operations: readonly PlanOperation[]): number {
  return operations.reduce(
    (sum, operation) => sum + (operation.kind === "setBaseChoices" ? operation.choices.length : 0),
    0,
  );
}

/**
 * Whether a change takes back time a choice cheaper than a base's core freed: a quick lesson or a
 * skip that becomes its core or more. The plan with every base at its core is what a choice never
 * pushes a topic out of, so a topic only that spare time held may go.
 */
function takesBackSpareTime({
  before,
  operations,
}: {
  before: RulePlan;
  operations: readonly PlanOperation[];
}): boolean {
  const was = new Map(before.settings.baseChoices.map((entry) => [entry.skillId, entry.choice]));

  return operations.some(
    (operation) =>
      operation.kind === "setBaseChoices" &&
      operation.choices.some(({ choice, skillId }) => {
        const cost = BASE_CHOICE_COSTS[was.get(skillId) ?? "essential"];
        return cost < BASE_CHOICE_COSTS.essential && BASE_CHOICE_COSTS[choice] > cost;
      }),
  );
}

/**
 * The bases these choices set short of deep study whose core the learner studied, none of their
 * lessons still to do: nothing of them is left to study, so the choice changes nothing (the lead,
 * 10 Oct). Read as the planner reads it (`listStudiedCores`), from the Library's lesson links: a
 * quick lesson done is no studied core, so a core asked for after it brings lessons back.
 */
function listFinishedBaseChoices({
  operations,
  plan,
}: {
  operations: readonly PlanOperation[];
  plan: RulePlan;
}): string[] {
  const studied = listStudiedCores({
    graph: plan.graph,
    items: plan.items,
    lessons: [...(plan.taughtBy ?? [])].map(([lessonId, skillIds]) => ({
      chapterId: null,
      lessonId,
      skillIds,
    })),
  });

  return operations.flatMap((operation) =>
    operation.kind === "setBaseChoices"
      ? operation.choices
          .filter((choice) => choice.choice !== "deep" && studied.has(choice.skillId))
          .map((choice) => choice.skillId)
      : [],
  );
}

/**
 * R15. A base choice never pushes out a topic its core keeps: after a change that only sets how
 * bases are studied, the only notice topics that leave the plan are those of the bases it skips,
 * unless it takes back the spare time a quick lesson or a skip freed, which held them (class test
 * seed 1117: back on its core, a base took the time that kept a topic the core plan never did; R11
 * judges which topic goes, R3 that the card names it). Work set aside before comes back only when
 * it costs no topic the plan holds, and a choice for a base the learner finished changes nothing
 * (class test seed 1255: a quick lesson for a finished base swapped cell theory for osmosis). The
 * editor's Undo of a base choice (`setBack`) gives back the plan before it, which isn't a choice.
 */
export function checkBaseChoicesKeepTopics(context: RuleContext): RuleViolation[] {
  const { after, before, event } = context;

  const onlyBases =
    event.kind === "learnerChange" &&
    !event.setBack &&
    event.operations.length > 0 &&
    event.operations.every((operation) => operation.kind === "setBaseChoices");

  if (!before || !onlyBases) {
    return [];
  }

  const finished = listFinishedBaseChoices({ operations: event.operations, plan: before });
  const allFinished = finished.length === countBaseChoices(event.operations);

  const changedFinished =
    allFinished && !isPlanUnchanged({ after, before })
      ? [
          {
            details: { bases: finished },
            message: "A choice for a base the learner finished changed the plan.",
            rule: "R15",
          },
        ]
      : [];

  if (takesBackSpareTime({ before, operations: event.operations })) {
    return changedFinished;
  }

  const areaOf = getAreaOf(after.graph);
  const topicsOf = getSkillTopics(after.graph);

  const skippedTopics = new Set(
    event.operations.flatMap((operation) =>
      operation.kind === "setBaseChoices"
        ? operation.choices
            .filter((choice) => choice.choice === "skip")
            .flatMap((choice) => {
              const skill = after.graph.skills.find((entry) => entry.skillId === choice.skillId);
              const area = areaOf(choice.skillId) ?? "";
              return (skill ? topicsOf(skill) : []).map((topic) => toAreaTopicKey({ area, topic }));
            })
        : [],
    ),
  );

  const left = listMissingKeys({ from: listPlannedTopics(before), to: listPlannedTopics(after) });

  return [
    ...changedFinished,
    ...left
      .filter((topic) => !skippedTopics.has(topic))
      .map((topic) => ({
        details: { topic },
        message: "A base choice pushed a topic out of the plan.",
        rule: "R15",
      })),
  ];
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
