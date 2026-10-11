import { addDays, daysBetween, fromIsoDate, toIsoDate } from "../../planner/plan-calendar";
import { type RuleContext, type RuleItem, type RulePlan, type RuleViolation } from "./rule-context";
import {
  findFirstDue,
  findLastDue,
  getAreaOf,
  isDueOn,
  isHeldOnShownEnd,
  isTodoLesson,
  toDay,
} from "./rule-items";

/** A test this many days away or closer gets a day-by-day plan with one mock of its own. */
const SHORT_PLAN_DAYS = 7;

function getPlanStart({ plan, today }: { plan: RulePlan; today: Date }): Date {
  return plan.settings.startDate ? fromIsoDate(plan.settings.startDate) : today;
}

function isStudyItem(item: RuleItem): boolean {
  return (item.kind === "lesson" || item.kind === "chapter") && item.status === "todo";
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
 * R21. Rest days rest: nothing to do is due on a weekday the learner gives no time, but the plan's
 * first day (it always has time), a weekly event the learner moved there, and a phase's challenge
 * held on the end the learner saw while Today asks to move that end, or after they kept it on a card
 * that said it rests there.
 */
export function checkRestDaysRest(context: RuleContext): RuleViolation[] {
  const { after, today } = context;
  const { settings } = after;
  const first = toIsoDate(getPlanStart({ plan: after, today }));
  const moved = new Set(settings.movedEvents.map((event) => event.to));

  const isRestDay = (date: Date) => {
    const day = toIsoDate(date);
    const minutes = settings.weekdayMinutes?.[date.getUTCDay()] ?? after.goal.dailyMinutes;
    return minutes === 0 && day !== first && !moved.has(day);
  };

  return after.items
    .filter(
      (item) =>
        item.status === "todo" &&
        item.scheduledFor &&
        isRestDay(item.scheduledFor) &&
        !isHeldOnShownEnd({ context, item, reason: "restDay" }),
    )
    .map((item) => ({
      details: {
        day: toDay(item.scheduledFor?.getTime() ?? null),
        kind: item.kind,
        title: item.titleSnapshot,
      },
      message: "Something is due on a rest day.",
      rule: "R21",
    }));
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

/** A class test's plan: days away, with its own short mock (see `PlanSettings.shortMockMinutes`). */
function isShortPlan({ plan, today }: { plan: RulePlan; today: Date }): boolean {
  const { targetDate } = plan.goal;

  return (
    targetDate !== null && daysBetween(getPlanStart({ plan, today }), targetDate) <= SHORT_PLAN_DAYS
  );
}

/**
 * R23. The day before a test brings nothing new: no lesson is due on it (unless the plan starts
 * that day), and a class test's is its full review: its short mock or a review of every topic.
 * Once that day comes, the lessons on it are the ones earlier days left: Today offers them after
 * the review, "if you have time" (`catchUpToday`), so only lessons planned on it ahead count.
 */
export function checkDayBeforeTest(context: RuleContext): RuleViolation[] {
  const { after, today } = context;
  const { targetDate } = after.goal;

  if (after.goal.kind !== "exam" || !targetDate) {
    return [];
  }

  const day = addDays(targetDate, -1);
  const starts = getPlanStart({ plan: after, today });

  if (starts >= day || today > day) {
    return [];
  }

  const onDay = after.items.filter((item) => isDueOn({ day, item }));
  const lessons = today < day ? onDay.filter((item) => isStudyItem(item)) : [];

  const isClassTest =
    after.settings.shortMockMinutes !== null && isShortPlan({ plan: after, today });

  const hasReview = onDay.some((item) => item.kind === "mock" || item.kind === "review");

  return [
    lessons.length > 0 && { lessons: lessons.map((item) => item.titleSnapshot) },
    isClassTest && !hasReview && { review: false },
  ]
    .filter((problem) => problem !== false)
    .map((details) => ({
      details: { day: toIsoDate(day), ...details },
      message: "The day before the test isn't a review.",
      rule: "R23",
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

/**
 * R39. Phases keep their order: among the phases with something still to do, each starts no
 * earlier and ends no earlier than the one before. A phase the learner finished (done or tested
 * out) may show the days it was finished on.
 */
export function checkPhasesInOrder(context: RuleContext): RuleViolation[] {
  const { after } = context;

  const open = after.phases.flatMap((phase, index) =>
    phase.startDate !== null &&
    phase.endDate !== null &&
    after.items.some((item) => item.phase === index && item.status === "todo")
      ? [{ end: phase.endDate, index, start: phase.startDate }]
      : [],
  );

  return open.flatMap((phase, position) => {
    const previous = open[position - 1];

    return previous && (phase.start < previous.start || phase.end < previous.end)
      ? [
          {
            details: { phase, previous },
            message: `Phase ${phase.index + 1} runs ${phase.start} to ${phase.end}, before phase ${previous.index + 1} (${previous.start} to ${previous.end}).`,
            rule: "R39",
          },
        ]
      : [];
  });
}
