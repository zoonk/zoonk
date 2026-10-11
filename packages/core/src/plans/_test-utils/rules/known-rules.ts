import { meetsKnownBar } from "../../../learner/_utils/skill-claims";
import { addDays, fromIsoDate, toIsoDate } from "../../planner/plan-calendar";
import { findChoiceDay, isNamedBack } from "./passed-over";
import {
  type RuleAnswer,
  type RuleContext,
  type RuleItem,
  type RulePlan,
  type RuleViolation,
} from "./rule-context";
import { getAreaOf, isTodoLesson, listPassedOver, listTakenOut } from "./rule-items";

/** A skill the plan treats as known: it has lessons, and every one of them was tested out. */
function isKnown({ items, skillId }: { items: readonly RuleItem[]; skillId: string }): boolean {
  const own = items.filter((item) => item.kind === "lesson" && item.skillId === skillId);
  return own.length > 0 && own.every((item) => item.status === "testedOut");
}

function hasTodo({ items, skillId }: { items: readonly RuleItem[]; skillId: string }): boolean {
  return items.some((item) => isTodoLesson(item) && item.skillId === skillId);
}

/** Whether the learner asked to focus on a skill: its area whole, or a part naming it. */
function isFocused({ plan, skillId }: { plan: RulePlan; skillId: string }): boolean {
  const area = getAreaOf(plan.graph)(skillId) ?? "";
  const part = plan.settings.focusParts.find((entry) => entry.area === area);

  return part ? part.skillIds.includes(skillId) : plan.settings.focusAreas.includes(area);
}

/**
 * Whether a skill's own answers take it as known, by the one bar test-out, the plan's cut and the
 * syllabus read (`meetsKnownBar`). A lesson's checks are part of learning it, not a test of it, so
 * they count neither way, as the claims read answers (`loadAnswerEvents`).
 */
function hasOwnEvidence({
  answers,
  focused,
  skillId,
}: {
  answers: readonly RuleAnswer[];
  focused: boolean;
  skillId: string;
}): boolean {
  return meetsKnownBar({
    answers: answers
      .filter((answer) => answer.skillId === skillId && answer.source !== "lesson")
      .map((answer) => ({ isCorrect: answer.correct, trueFalse: answer.format === "trueFalse" })),
    focused,
  });
}

/**
 * The steps that could take a skill as known: a new plan (placement before it), placement, a
 * session, a test-out, and a learner's change (passing over basics never makes them known).
 */
const KNOWING_EVENTS = new Set(["learnerChange", "placement", "planCreated", "session", "testOut"]);

/**
 * R17. A topic counts as known only from answers on that topic itself: a skill a step takes as
 * known (every one of its lessons tested out) has a right answer of its own (two when the learner
 * focused on it, three when they're true or false) and no miss anywhere. What answers on other
 * skills suggest (D2) and what the learner says they know, a subject or a level (D9), only mark it
 * "to confirm": its lessons stay until its own answers confirm it. Passing basics over by choice
 * ("Skip", an area too basic) takes their lessons out, never marks them known (RULES 4). A
 * measured level is a test of its own: a language level test's bands below the level may be tested
 * out (`learner.measuredSkillIds`), unlike a level the learner only stated.
 */
export function checkKnownHasEvidence(context: RuleContext): RuleViolation[] {
  const { after, answers, before, event, learner } = context;

  if (!answers || !KNOWING_EVENTS.has(event.kind)) {
    return [];
  }

  const measured = new Set(learner?.measuredSkillIds);

  const wasKnown = (skillId: string) =>
    measured.has(skillId) || (before !== null && isKnown({ items: before.items, skillId }));

  return after.graph.skills
    .map((skill) => skill.skillId)
    .filter((skillId) => !wasKnown(skillId) && isKnown({ items: after.items, skillId }))
    .filter(
      (skillId) =>
        !hasOwnEvidence({ answers, focused: isFocused({ plan: after, skillId }), skillId }),
    )
    .map((skillId) => ({
      details: {
        answers: answers
          .filter((answer) => answer.skillId === skillId)
          .map(({ correct, format, source }) => ({ correct, format, source })),
        skillId,
      },
      message: "A skill was tested out without answers of its own.",
      rule: "R17",
    }));
}

/** A known topic gets a practice question within this many days of being confirmed (D1). */
const PRACTICE_WITHIN_DAYS = 14;

/** Known topics join practice about a week after they're confirmed. */
const PRACTICE_JOINS_DAYS = 7;

/** The day a known skill was confirmed: the first of its lessons tested out. */
function findConfirmedDay({ items, skillId }: { items: readonly RuleItem[]; skillId: string }) {
  const times = items.flatMap((item) =>
    item.kind === "lesson" && item.skillId === skillId && item.completedAt
      ? [item.completedAt.getTime()]
      : [],
  );

  return times.length > 0 ? fromIsoDate(toIsoDate(new Date(Math.min(...times)))) : null;
}

/**
 * Whether practice skipped a skill in the two weeks from `since`: those weeks are over, the learner
 * studied in the second one, and none of the sessions since `since` asked it.
 */
function isLeftOutOfPractice({
  sessions,
  since,
  skillId,
  today,
}: {
  sessions: NonNullable<RuleContext["sessions"]>;
  since: Date;
  skillId: string;
  today: Date;
}): boolean {
  const [joins, ends] = [addDays(since, PRACTICE_JOINS_DAYS), addDays(since, PRACTICE_WITHIN_DAYS)];

  if (today < ends) {
    return false;
  }

  const window = sessions.filter((session) => session.day >= since && session.day < ends);
  const studied = window.some((session) => session.day >= joins);

  return studied && !window.some((session) => session.practiceSkillIds.includes(skillId));
}

/** Each skill passed over by choice and still to confirm, with the day the learner chose it. */
function listPassedOverDays({
  after,
  learnerChanges,
}: Pick<RuleContext, "after" | "learnerChanges">): { since: Date; skillId: string }[] {
  if (!learnerChanges) {
    return [];
  }

  return [...listPassedOver(after)].flatMap((skillId) => {
    const since = findChoiceDay({ learnerChanges, plan: after, skillId });
    return since ? [{ since, skillId }] : [];
  });
}

/**
 * R18. Known topics keep practice: they join mixed practice on the same spaced schedule as studied
 * topics, about a week after they're confirmed, and each gets at least one practice question in
 * its first two weeks: once those two weeks are over, a learner who studied in their second week
 * was asked it by one of the sessions since it was confirmed. Basics the learner passed over by
 * choice ("Skip", an area too basic) are still to confirm, so the same holds from the day they
 * chose it (RULES 4). A skill of an area the learner took out is left out of practice. A free
 * exam plan past its trial asks them in its quick review, which counts as practice here.
 */
export function checkKnownGetsPractice(context: RuleContext): RuleViolation[] {
  const { after, sessions, today } = context;

  if (!sessions) {
    return [];
  }

  const takenOut = listTakenOut(after);

  const known = after.graph.skills.flatMap(({ skillId }) => {
    const since =
      isKnown({ items: after.items, skillId }) && !takenOut.has(skillId)
        ? findConfirmedDay({ items: after.items, skillId })
        : null;

    return since ? [{ since, skillId }] : [];
  });

  const passedOver = listPassedOverDays(context);

  return [
    ...known.map((skill) => ({ ...skill, message: "A known topic" })),
    ...passedOver.map((skill) => ({ ...skill, message: "A topic passed over by choice" })),
  ]
    .filter(({ since, skillId }) => isLeftOutOfPractice({ sessions, since, skillId, today }))
    .map(({ message, since, skillId }) => ({
      details: { since: toIsoDate(since), skillId },
      message: `${message} got no practice question in its first two weeks.`,
      rule: "R18",
    }));
}

/**
 * The skills a step's own answers missed that the plan held no lessons of before: known ones
 * (every lesson tested out) and ones passed over by choice, still to confirm.
 */
function listMissedSettled({ before, event }: Pick<RuleContext, "before" | "event">): string[] {
  const answers = "answers" in event ? (event.answers ?? []) : [];

  if (!before) {
    return [];
  }

  const passedOver = listPassedOver(before);
  const takenOut = listTakenOut(before);

  return [
    ...new Set(
      answers
        .filter(
          (answer) =>
            !answer.correct &&
            !takenOut.has(answer.skillId) &&
            (passedOver.has(answer.skillId) ||
              isKnown({ items: before.items, skillId: answer.skillId })),
        )
        .map((answer) => answer.skillId),
    ),
  ];
}

/**
 * R37. A skill the goal's exam practices only with recordings (`learner.listeningSkillIds`) is
 * asked only with a recording's questions: no step asks it a text question (so placement, which
 * asks text questions one at a time, never asks it) and no step takes it as known without a right
 * answer to a recording's question. Its lessons stay as any other skill's.
 */
export function checkListeningOnlyRecorded(context: RuleContext): RuleViolation[] {
  const { after, answers = [], before, event, learner } = context;
  const listening = new Set(learner?.listeningSkillIds);
  const stepAnswers = "answers" in event ? (event.answers ?? []) : [];

  const asked = stepAnswers
    .filter(
      (answer) =>
        listening.has(answer.skillId) && answer.source !== "lesson" && answer.recording !== true,
    )
    .map((answer) => answer.skillId);

  const testedOut = [...listening].filter(
    (skillId) =>
      !(before !== null && isKnown({ items: before.items, skillId })) &&
      isKnown({ items: after.items, skillId }) &&
      !answers.some(
        (answer) => answer.skillId === skillId && answer.correct && answer.recording === true,
      ),
  );

  return [...new Set([...asked, ...testedOut])].map((skillId) => ({
    details: { asked: asked.includes(skillId), skillId, testedOut: testedOut.includes(skillId) },
    message:
      "A skill practiced only with recordings was asked a text question or known without one.",
    rule: "R37",
  }));
}

/**
 * R19. A miss on a known topic brings its lessons back: after a step whose answers include a wrong
 * one on a skill the plan had as known, or had passed over by the learner's choice ("Skip", an
 * area too basic: still to confirm), the plan has lessons to do on it again, and a change of the
 * step names it among the topics it brings back. A skill of an area the learner took out stays out.
 */
export function checkMissBringsLessonsBack(context: RuleContext): RuleViolation[] {
  const { after, changes } = context;

  return listMissedSettled(context).flatMap((skillId) => {
    if (!hasTodo({ items: after.items, skillId })) {
      return [
        {
          details: { skillId },
          message: "A miss on a known or passed-over topic didn't bring its lessons back.",
          rule: "R19",
        },
      ];
    }

    return changes && !isNamedBack({ changes, plan: after, skillId })
      ? [
          {
            details: { skillId },
            message: "A miss brought a topic's lessons back without a change naming it.",
            rule: "R19",
          },
        ]
      : [];
  });
}
