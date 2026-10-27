import { addDays, daysBetween, fromIsoDate, toIsoDate } from "../../planner/plan-calendar";
import { type RuleContext, type RuleItem, type RulePlan, type RuleViolation } from "./rule-context";
import { findFirstDue, findLastDue, getAreaOf, isDueOn, isTodoLesson } from "./rule-items";

function getPlanStart({ plan, today }: { plan: RulePlan; today: Date }): Date {
  return plan.settings.startDate ? fromIsoDate(plan.settings.startDate) : today;
}

/** R20. Day one always has a session: a new plan has something to do on its first day. */
export function checkDayOneHasSession(context: RuleContext): RuleViolation[] {
  const { after, event, today } = context;

  if (event.kind !== "planCreated") {
    return [];
  }

  const day = getPlanStart({ plan: after, today });
  const hasWork = after.items.some((item) => item.status === "todo" && isDueOn({ day, item }));

  return hasWork
    ? []
    : [
        {
          details: { day: toIsoDate(day) },
          message: "A new plan has nothing on its first day.",
          rule: "R20",
        },
      ];
}

/**
 * R22. Day one opens with what the learner doesn't know yet: when placement found gaps (or they
 * said they don't know an area), the first lesson of a new plan is in one of those areas, and no
 * lesson of an area they said they know comes before one of a notice area they didn't (areas
 * beyond the notice come last, after the known ones).
 */
export function checkDayOneOpensWithGaps(context: RuleContext): RuleViolation[] {
  const { after, event, learner, today } = context;
  const gaps = new Set(learner?.gapAreas);
  const knownAreas = new Set(learner?.knownAreas);

  if (event.kind !== "planCreated" || (gaps.size === 0 && knownAreas.size === 0)) {
    return [];
  }

  const areaOf = getAreaOf(after.graph);
  const day = getPlanStart({ plan: after, today });

  const dayOne = after.items
    .filter((item) => isTodoLesson(item) && isDueOn({ day, item }))
    .map((item) => areaOf(item.skillId) ?? "");

  const gapsPlanned = after.items.some(
    (item) => isTodoLesson(item) && gaps.has(areaOf(item.skillId) ?? ""),
  );

  const noticeAreas = new Set(
    after.graph.skills.flatMap((skill) =>
      (skill.topics ?? []).length > 0 ? (areaOf(skill.skillId) ?? []) : [],
    ),
  );

  const isUnknown = (area: string) =>
    !knownAreas.has(area) && (gaps.has(area) || noticeAreas.size === 0 || noticeAreas.has(area));

  const lastUnknown = dayOne.findLastIndex((area) => isUnknown(area));
  const firstKnown = dayOne.findIndex((area) => knownAreas.has(area));

  return [
    gapsPlanned &&
      dayOne.length > 0 &&
      !gaps.has(dayOne[0] ?? "") && { first: dayOne[0], gaps: [...gaps] },
    firstKnown !== -1 && firstKnown < lastUnknown && { knownBefore: dayOne[firstKnown] },
  ]
    .filter((problem) => problem !== false)
    .map((details) => ({
      details,
      message: "Day one doesn't open with what the learner doesn't know.",
      rule: "R22",
    }));
}

/** Whether some mock of the plan is due between two days, both included. */
function hasMockBetween({
  end,
  items,
  start,
}: {
  end: Date;
  items: readonly RuleItem[];
  start: Date;
}) {
  return items.some(
    (item) =>
      item.kind === "mock" &&
      item.scheduledFor !== null &&
      item.scheduledFor >= start &&
      item.scheduledFor <= end,
  );
}

/** An exam plan with this many study days before the exam has a mock of its own (D3). */
const MIN_MOCK_STUDY_DAYS = 3;

/** A window this long always holds a week's mock day past the plan's first week. */
const MOCK_WINDOW_DAYS = 14;

/** The days from `start` to the day before `end` the learner studies on (the plan's first always). */
function countStudyDays({ end, plan, start }: { end: Date; plan: RulePlan; start: Date }) {
  const minutesOn = (day: Date) =>
    plan.settings.weekdayMinutes?.[day.getUTCDay()] ?? plan.goal.dailyMinutes;

  return Array.from({ length: Math.max(0, daysBetween(start, end)) }, (_, index) => index).filter(
    (index) => index === 0 || minutesOn(addDays(start, index)) > 0,
  ).length;
}

/** The phases before the exam spanning two weeks or more that have no mock inside them. */
function listPhasesWithoutMock({
  plan,
  targetDate,
  today,
}: {
  plan: RulePlan;
  targetDate: Date;
  today: Date;
}) {
  return plan.phases.flatMap((phase, index) => {
    const afterExam =
      phase.kind === "afterExam" ||
      (phase.startDate !== null && fromIsoDate(phase.startDate) >= targetDate);

    if (!phase.startDate || !phase.endDate || afterExam) {
      return [];
    }

    const [start, end] = [fromIsoDate(phase.startDate), fromIsoDate(phase.endDate)];
    const long = daysBetween(start, end) + 1 >= MOCK_WINDOW_DAYS;

    return long && end >= today && !hasMockBetween({ end, items: plan.items, start })
      ? [{ kind: phase.kind, phase: index }]
      : [];
  });
}

/** An exam plan without a date, two weeks long or more, with no mock. */
function lacksUndatedMock(plan: RulePlan): boolean {
  const [first, last] = [findFirstDue(plan.items), findLastDue(plan.items)];

  const spans =
    first !== null &&
    last !== null &&
    daysBetween(new Date(first), new Date(last)) >= MOCK_WINDOW_DAYS;

  return spans && !plan.items.some((item) => item.kind === "mock");
}

/**
 * R24. Every exam plan has mocks: one with at least three study days before the exam has a mock of
 * its own before it (shorter ones rely on the mocks a learner takes any time), each phase before
 * the exam spanning two weeks or more has one while it has days left (the final stretch included;
 * the phase after the exam of a plan that studies everything is exempt), and so does a plan
 * without a date once it spans two weeks. A phase that ended before today owes nothing more: a
 * mock the learner didn't take there may leave, and the phase they are in has its own. From the
 * exam's day on, no day is left before it: a mock the learner didn't take may leave.
 */
export function checkMocksInEveryPhase(context: RuleContext): RuleViolation[] {
  const { after, today } = context;
  const { targetDate } = after.goal;

  if (after.goal.kind !== "exam" || (targetDate && today >= targetDate)) {
    return [];
  }

  if (!targetDate) {
    return lacksUndatedMock(after)
      ? [{ details: {}, message: "An exam plan without a date has no mocks.", rule: "R24" }]
      : [];
  }

  const start = getPlanStart({ plan: after, today });
  const beforeExam = addDays(targetDate, -1);

  // The study days left to place a mock on: one the learner missed may leave once too few remain.
  const studyDays = countStudyDays({
    end: targetDate,
    plan: after,
    start: today > start ? today : start,
  });

  const problems = [
    ...(studyDays >= MIN_MOCK_STUDY_DAYS &&
    !hasMockBetween({ end: beforeExam, items: after.items, start })
      ? [
          {
            details: { studyDays },
            message: "An exam plan with days to study has no mock before the exam.",
          },
        ]
      : []),
    ...listPhasesWithoutMock({ plan: after, targetDate, today }).map((details) => ({
      details,
      message: `The ${details.kind} phase has no mock.`,
    })),
  ];

  return problems.map((problem) => ({ ...problem, rule: "R24" }));
}
