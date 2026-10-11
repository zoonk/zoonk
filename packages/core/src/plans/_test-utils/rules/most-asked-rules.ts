import { type TopicLevel } from "../../../library/exams/topic-frequency";
import { countItemLessons } from "../../_utils/stand-in-lessons";
import { getCoreLessons } from "../../planner/core-first";
import { getEndOfWeek } from "../../planner/plan-calendar";
import { type ScoredTopic, scoreSkillTopics } from "../../planner/topic-weights";
import { type RuleContext, type RulePlan, type RuleViolation } from "./rule-context";
import {
  countSkillLessons,
  getAreaOf,
  getRuleItemKey,
  isPlanUnchanged,
  isTodoLesson,
  listOutByChoice,
  listSkillSizes,
} from "./rule-items";

/** Kept skills a violation names at most, so one cut topic reads as one finding. */
const MAX_NAMED = 5;

/** What a skill's lessons in the plan say about it. */
type SkillState = { hasDone: boolean; hasItems: boolean; hasTodo: boolean };

/** What each skill's lessons say about it; a lesson set aside for time (`skipped`) is out, as cut. */
function readSkillStates(plan: RulePlan): Map<string, SkillState> {
  const lessons = Map.groupBy(
    plan.items.filter(
      (item) => item.kind === "lesson" && item.skillId && item.status !== "skipped",
    ),
    (item) => item.skillId ?? "",
  );

  return new Map(
    plan.graph.skills.map((skill) => {
      const own = lessons.get(skill.skillId) ?? [];

      return [
        skill.skillId,
        {
          hasDone: own.some((item) => item.status !== "todo"),
          hasItems: own.length > 0,
          hasTodo: own.some((item) => isTodoLesson(item)),
        },
      ];
    }),
  );
}

/** Each skill's lessons the plan holds, done, tested out or still to do (set aside isn't held). */
function countHeldLessons(plan: RulePlan): Map<string, number> {
  return plan.items
    .filter((item) => item.kind === "lesson" && item.skillId && item.status !== "skipped")
    .reduce(
      (held, item) =>
        held.set(item.skillId ?? "", (held.get(item.skillId ?? "") ?? 0) + countItemLessons(item)),
      new Map<string, number>(),
    );
}

/** Every skill a skill builds on, however far back. */
function listAllPrerequisites({ plan, skillId }: { plan: RulePlan; skillId: string }): Set<string> {
  const found = new Set<string>();
  const queue = [...(plan.prerequisites?.get(skillId) ?? [])];

  while (queue.length > 0) {
    const next = queue.shift() ?? "";

    if (!found.has(next)) {
      found.add(next);
      queue.push(...(plan.prerequisites?.get(next) ?? []));
    }
  }

  return found;
}

/** Where a skill competes for time: its area, or the part of it a focus names. */
function getGroupOf(plan: RulePlan): (skillId: string) => string {
  const areaOf = getAreaOf(plan.graph);

  return (skillId) => {
    const part = plan.settings.focusParts.find((entry) => entry.skillIds.includes(skillId));
    return `${areaOf(skillId) ?? ""}${part ? `|${part.name}` : ""}`;
  };
}

/**
 * How a topic or a skill ranks for the time a short plan has: what the learner doesn't know yet
 * before what they showed they know (every skill of it known, none missed anywhere: the plan cuts
 * it first, practice keeps it), then what a class test's teacher announced (it will be asked, for
 * certain), then how often the exam asks it, then whether the learner missed it.
 */
function getRanker(context: RuleContext) {
  const announced = new Set(context.learner?.announcedSkillIds);

  const missed = new Set(
    (context.answers ?? []).filter((answer) => !answer.correct).map((answer) => answer.skillId),
  );

  const known = new Set(
    (context.learner?.knownSkillIds ?? []).filter((skillId) => !missed.has(skillId)),
  );

  const isKnown = (skillId: string) => known.has(skillId);

  const rank = (score: number, skillIds: readonly string[]): number[] =>
    skillIds.length > 0 && skillIds.every((skillId) => isKnown(skillId))
      ? [0, 0, score, 0]
      : [
          1,
          Number(skillIds.some((skillId) => announced.has(skillId))),
          score,
          Number(skillIds.some((skillId) => missed.has(skillId))),
        ];

  return { isKnown, rank };
}

function ranksBelow(a: readonly number[], b: readonly number[]): boolean {
  const index = a.findIndex((value, at) => value !== b[at]);
  return index !== -1 && (a[index] ?? 0) < (b[index] ?? 0);
}

/** Each notice topic with the skills that teach it and how often the exam asks it. */
function listTopics(scored: ReadonlyMap<string, readonly ScoredTopic[]>) {
  const topics = new Map<string, { score: number; skillIds: string[] }>();

  [...scored].forEach(([skillId, entries]) =>
    entries.forEach(({ key, score }) => {
      const topic = topics.get(key) ?? { score, skillIds: [] };
      topics.set(key, { score, skillIds: [...topic.skillIds, skillId] });
    }),
  );

  return topics;
}

/**
 * Each skill's lessons still to do that a cut topic could have taken. A session's run keeps this
 * week as the learner saw it (`keepThisWeek`), so the lessons it kept there aren't room: a missed
 * topic left out waits for the week after (class test seed 1212). A later step that leaves the plan
 * as it was ran nothing, so it reads the week as that run left it (class test seed 2148: the next
 * morning had nothing to settle).
 */
function countRoom(context: RuleContext): Map<string, number> {
  const { after, before, event, today } = context;

  if (!before || (event.kind !== "session" && !isPlanUnchanged({ after, before }))) {
    return countSkillLessons(after.items);
  }

  const weekEnd = getEndOfWeek(today);
  const shown = new Set(before.items.map((item) => getRuleItemKey(item)));

  return countSkillLessons(
    after.items.filter(
      (item) =>
        !item.scheduledFor || item.scheduledFor > weekEnd || !shown.has(getRuleItemKey(item)),
    ),
  );
}

/**
 * What R11 reads from the plan after the step: each skill's state, rank, group, bases and size,
 * and the notice topics it leaves out for time (no skill teaching them has an item, and none is
 * out by the learner's choice).
 */
function readPlanCuts({
  context,
  levels,
}: {
  context: RuleContext;
  levels: readonly TopicLevel[];
}) {
  const { after } = context;
  const scored = scoreSkillTopics({ graph: after.graph, levels });
  const states = readSkillStates(after);
  const outByChoice = listOutByChoice(after);
  const { isKnown, rank } = getRanker(context);
  const skillIds = after.graph.skills.map((skill) => skill.skillId);
  const sizes = listSkillSizes(after);

  const skillScore = (skillId: string) =>
    Math.max(0, ...(scored.get(skillId) ?? []).map((topic) => topic.score));

  const basesOf = new Map(
    skillIds.map((skillId) => [skillId, listAllPrerequisites({ plan: after, skillId })]),
  );

  const topics = listTopics(scored);

  const cuts = [...topics].flatMap(([topic, { score, skillIds: own }]) =>
    own.every((skillId) => !states.get(skillId)?.hasItems && !outByChoice.has(skillId))
      ? [{ rank: rank(score, own), skillIds: own, topic }]
      : [],
  );

  // A skill ranks as the highest of the topics it brings in, each ranked as a cut topic is (with
  // every skill that teaches it): the one way in to an announced topic ranks as announced. One the
  // learner showed they know ranks as known, whatever topic it teaches: its lessons go first.
  const rankSkill = (skillId: string) =>
    isKnown(skillId)
      ? rank(skillScore(skillId), [skillId])
      : (scored.get(skillId) ?? [])
          .map(({ key, score }) => rank(score, topics.get(key)?.skillIds ?? [skillId]))
          .reduce((best, next) => (ranksBelow(best, next) ? next : best), rank(0, [skillId]));

  return {
    areaOf: getAreaOf(after.graph),
    basesOf,
    coreOf: (skillId: string) => getCoreLessons(sizes.get(skillId) ?? 1),
    cuts,
    groupOf: getGroupOf(after),
    held: countHeldLessons(after),
    // Lessons still to do and none studied yet: the chapter in progress doesn't count.
    isUntouched: (skillId: string) =>
      Boolean(states.get(skillId)?.hasTodo && !states.get(skillId)?.hasDone),
    outByChoice,
    rankSkill,
    reached: skillIds.filter((skillId) => states.get(skillId)?.hasItems),
    room: countRoom(context),
    skillIds,
    skillScore,
    states,
    todo: countSkillLessons(after.items),
  };
}

type PlanCuts = ReturnType<typeof readPlanCuts>;
type CutTopic = PlanCuts["cuts"][number];

/** Every skill a cut topic's skills build on, however far back. */
function listCutBases({ cut, plan }: { cut: CutTopic; plan: PlanCuts }): Set<string> {
  return new Set(cut.skillIds.flatMap((skillId) => [...(plan.basesOf.get(skillId) ?? [])]));
}

/**
 * The lessons a cut topic needs to be in the plan whole: the core of the skill that teaches it
 * at least cost, and of each base that skill builds on the core lessons the plan doesn't hold yet
 * (see `getCoreLessons`): a base held in part still misses the rest of its core (ENEM seed 1: a
 * stand-in at 7 of a 10-lesson core). A base in the skill's own subject has its core first, so one
 * the learner started misses the core lessons they haven't done and the plan doesn't hold (Câmara
 * seed 2141); a base in another subject only has to be started, and a tested-out one is held. One
 * skill brings a topic in; another skill of it comes after every topic has one, as the planner
 * ranks cores.
 */
function countTopicNeed({ cut, plan }: { cut: CutTopic; plan: PlanCuts }): number {
  const countBaseNeed = ({ baseId, skillId }: { baseId: string; skillId: string }) => {
    if (plan.outByChoice.has(baseId)) {
      return 0;
    }

    if (plan.states.get(baseId)?.hasDone) {
      return plan.areaOf(baseId) === plan.areaOf(skillId)
        ? Math.max(0, plan.coreOf(baseId) - (plan.held.get(baseId) ?? 0))
        : 0;
    }

    return Math.max(0, plan.coreOf(baseId) - (plan.todo.get(baseId) ?? 0));
  };

  const countSkillNeed = (skillId: string) =>
    [...(plan.basesOf.get(skillId) ?? [])].reduce(
      (sum, baseId) => sum + countBaseNeed({ baseId, skillId }),
      plan.coreOf(skillId),
    );

  return Math.min(...cut.skillIds.map((skillId) => countSkillNeed(skillId)));
}

/**
 * Cut topics that would have fit whole in the time less-asked topics of their subject keep: their
 * need is no more than those topics' lessons still to do. A topic too big for the time may go,
 * and the next-ranked one that fits whole takes the time. A kept skill the cut topic builds on
 * doesn't count (dropping it doesn't make room), nor one that a reached topic ranked at least as
 * high builds on (it comes with that topic).
 */
function findCutsThatFit(plan: PlanCuts): RuleViolation[] {
  const kept = plan.skillIds.filter(
    (skillId) => plan.isUntouched(skillId) && plan.skillScore(skillId) > 0,
  );

  const isBaseOfAsked = ({ skillId, topicRank }: { skillId: string; topicRank: number[] }) =>
    plan.reached.some(
      (other) =>
        !ranksBelow(plan.rankSkill(other), topicRank) && plan.basesOf.get(other)?.has(skillId),
    );

  return plan.cuts.flatMap((cut) => {
    const groups = new Set(cut.skillIds.map((skillId) => plan.groupOf(skillId)));
    const ownBases = listCutBases({ cut, plan });

    const below = kept.filter(
      (skillId) =>
        groups.has(plan.groupOf(skillId)) &&
        (plan.room.get(skillId) ?? 0) > 0 &&
        !ownBases.has(skillId) &&
        ranksBelow(plan.rankSkill(skillId), cut.rank) &&
        !isBaseOfAsked({ skillId, topicRank: cut.rank }),
    );

    const held = below.reduce((sum, skillId) => sum + (plan.room.get(skillId) ?? 0), 0);
    const needs = countTopicNeed({ cut, plan });

    return below.length > 0 && needs <= held
      ? [
          {
            details: {
              held,
              kept: below.slice(0, MAX_NAMED),
              keptCount: below.length,
              needs,
              topic: cut.topic,
            },
            message: `"${cut.topic}" is out of the plan while less-asked topics of its subject keep the lessons it would fit in.`,
            rule: "R11",
          },
        ]
      : [];
  });
}

/**
 * Kept skills no notice topic asks that only cut topics build on: time spent on the way to a
 * topic the plan won't reach. A base that is an asked topic itself ranks on its own.
 */
function findBasesOfCutTopics(plan: PlanCuts): RuleViolation[] {
  const isBuiltOnInPlan = (skillId: string) =>
    plan.reached.some((other) => other !== skillId && plan.basesOf.get(other)?.has(skillId));

  return plan.cuts.flatMap((cut) => {
    const bases = [...listCutBases({ cut, plan })].filter(
      (skillId) =>
        plan.isUntouched(skillId) && plan.skillScore(skillId) === 0 && !isBuiltOnInPlan(skillId),
    );

    return bases.length > 0
      ? [
          {
            details: {
              bases: bases.slice(0, MAX_NAMED),
              basesCount: bases.length,
              topic: cut.topic,
            },
            message: `Bases of "${cut.topic}" keep lessons, though the topic is out of the plan for time and nothing in it builds on them.`,
            rule: "R11",
          },
        ]
      : [];
  });
}

/**
 * R11. Every topic's core comes before any depth, most asked first: within a subject (or the part
 * of it a focus names), a notice topic the plan leaves out for time never ranks above topics whose
 * lessons it keeps when it would have fit whole in their time, and no time goes to bases of a
 * topic the plan won't reach unless they're asked topics themselves. A topic a class test's teacher
 * announced ranks above any other (it will be asked); among announced ones, and among the others,
 * most asked first, then what the learner missed (any wrong answer, placement included). What the
 * learner showed they know ranks below everything they don't. Topics the learner took out, skipped
 * as a base or starts past, tested-out ones and the chapter in progress don't count, nor the lessons
 * a session's run keeps this week as the learner saw them. An undo is R38's: it gives back a plan
 * judged when it was built.
 */
export function checkMostAskedKept(context: RuleContext): RuleViolation[] {
  const levels = context.after.topicLevels ?? [];

  // An undo gives back the plan as it was built, judged then; R38 checks it does.
  if (levels.length === 0 || context.event.kind === "undo") {
    return [];
  }

  const plan = readPlanCuts({ context, levels });
  return [...findCutsThatFit(plan), ...findBasesOfCutTopics(plan)];
}
