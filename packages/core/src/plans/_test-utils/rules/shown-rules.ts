import { toTopicKey } from "../../../library/exams/topic-key";
import { MAX_DAILY_MINUTES } from "../../planner/plan-state";
import { type RuleContext, type RuleItem, type RulePlan, type RuleViolation } from "./rule-context";
import { getAreaOf } from "./rule-items";

/** How much of a shown text a violation quotes. */
const QUOTE_LENGTH = 120;

/**
 * Wordings that promise a pass, a score or a job, in the app's main languages. A heuristic: it
 * catches the plain promises, not every way to imply one.
 */
const PROMISES: readonly RegExp[] = [
  /\b(?:vai|vão|você vai|voce vai) (?:passar|ser aprovad|tirar \d|conseguir a vaga)/iu,
  /\baprova[çc][ãa]o garantida\b/iu,
  /\bgarant(?:e|imos|ida|ido)\b.{0,30}\b(?:aprova|vaga|nota|emprego|passar)/iu,
  /\byou(?:'ll| will) (?:pass|get the job|score)\b/iu,
  /\bguarantee(?:d|s)?\b.{0,30}\b(?:pass|score|job)\b/iu,
];

function quote(text: string): string {
  return text.slice(0, QUOTE_LENGTH);
}

/** A topic's lessons in the plan: whether any is still to do, and whether any was studied. */
function readTopic({
  areas,
  name,
  plan,
}: {
  areas: readonly string[];
  name: string;
  plan: RulePlan;
}) {
  const areaOf = getAreaOf(plan.graph);
  const key = toTopicKey(name);

  const skillIds = new Set(
    plan.graph.skills
      .filter((skill) => areas.includes(areaOf(skill.skillId) ?? ""))
      .filter((skill) => (skill.topics ?? []).some((topic) => toTopicKey(topic) === key))
      .map((skill) => skill.skillId),
  );

  const own = plan.items.filter(
    (item: RuleItem) => item.kind === "lesson" && skillIds.has(item.skillId ?? ""),
  );

  return {
    hasDone: own.some((item) => item.status === "done"),
    hasTodo: own.some((item) => item.status === "todo"),
    taught: skillIds.size > 0,
  };
}

/** Each syllabus topic whose status says something about the plan its lessons don't. */
function listFalseStatuses(context: RuleContext) {
  const { after, syllabus } = context;

  return (syllabus?.subjects ?? []).flatMap((subject) =>
    subject.topics.flatMap((topic) => {
      const lessons = readTopic({ areas: subject.areas, name: topic.name, plan: after });
      const begun = topic.status === "toStudy" || topic.status === "inProgress";
      const saysOut = topic.status === "notPlanned";
      // A topic begun whose rest was set aside for time says the rest is out of the plan.
      const saysRestOut = begun && topic.notPlannedReason !== null;
      const saysToDo = begun && !saysRestOut;

      const isFalse =
        lessons.taught &&
        ((saysToDo && !lessons.hasTodo) ||
          (saysRestOut && lessons.hasTodo) ||
          (saysOut && (lessons.hasTodo || lessons.hasDone)));

      return isFalse ? [{ status: topic.status, subject: subject.name, topic: topic.name }] : [];
    }),
  );
}

/**
 * R25. What the plan says it covers is true: a syllabus topic shown to study has lessons to do,
 * one shown out of the plan has none; "every topic fits" (the plan's `coreFits`) never stands next
 * to topics left out for time; and a plan said to fit in depth fits every topic.
 */
export function checkCoverageTrue(context: RuleContext): RuleViolation[] {
  const { syllabus, view } = context;
  const feasibility = view?.feasibility ?? null;
  const topics = (syllabus?.subjects ?? []).flatMap((subject) => subject.topics);

  const outForTime = topics.filter(
    (topic) => topic.status === "notPlanned" && topic.notPlannedReason === "time",
  );

  const problems = [
    ...listFalseStatuses(context).map((details) => ({
      details,
      message: `The syllabus says "${details.topic}" is ${details.status ?? "unknown"}, which its lessons don't show.`,
    })),
    ...(feasibility?.coreFits && outForTime.length > 0
      ? [
          {
            details: { outForTime: outForTime.length },
            message: "The plan says every topic fits while topics are out for time.",
          },
        ]
      : []),
    ...(feasibility?.fits && !feasibility.coreFits
      ? [
          {
            details: { coreFits: false },
            message: "The plan says it fits in depth while not every topic fits.",
          },
        ]
      : []),
  ];

  return problems.map((problem) => ({ ...problem, rule: "R25" }));
}

/**
 * R26. The recommended time covers the goal: at or above the daily time the plan recommends,
 * everything fits by the date, and the recommendation is never more than the most time a day.
 */
export function checkRecommendedTimeCovers(context: RuleContext): RuleViolation[] {
  const feasibility = context.view?.feasibility ?? null;
  const recommended = feasibility?.recommendedMinutes ?? null;

  if (!context.view || !feasibility || recommended === null) {
    return [];
  }

  const { dailyMinutes } = context.view.schedule;

  return [
    dailyMinutes >= recommended && !feasibility.fits && { dailyMinutes, fits: false, recommended },
    recommended > MAX_DAILY_MINUTES && { recommended },
  ]
    .filter((problem) => problem !== false)
    .map((details) => ({
      details,
      message: "The recommended daily time doesn't cover the goal.",
      rule: "R26",
    }));
}

/** R27. No em dashes in what the learner reads, but quoted sources, which keep their own. */
export function checkNoEmDashes(context: RuleContext): RuleViolation[] {
  return (context.shown ?? [])
    .filter((text) => !text.quoted && text.text.includes("—"))
    .map((text) => ({
      details: { source: text.source, text: quote(text.text) },
      message: `An em dash in ${text.source}.`,
      rule: "R27",
    }));
}

/** R28. Never promise a pass, a score or a job (a heuristic over the plain wordings). */
export function checkNoPromises(context: RuleContext): RuleViolation[] {
  return (context.shown ?? [])
    .filter((text) => !text.quoted && PROMISES.some((pattern) => pattern.test(text.text)))
    .map((text) => ({
      details: { source: text.source, text: quote(text.text) },
      message: `A promise of a result in ${text.source}.`,
      rule: "R28",
    }));
}
