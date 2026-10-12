import { type CourseLevel, type GoalKind } from "@zoonk/db";
import { type TopicLevel } from "../../library/exams/topic-frequency";
import { continueAfterExam } from "./after-exam";
import { scheduleCarriedAndRest } from "./carried-and-rest";
import { type CarryOver } from "./carry-over";
import { getKeptBaseChoices, hasBaseChoices, withBaseChoices } from "./chosen-bases";
import {
  keepThisWeek,
  listKeptStandInCuts,
  listThisWeekWork,
  setAsideLeftWork,
  splitExistingItems,
  toKeptItem,
} from "./kept-items";
import { type StrainedEnd, listEndsBeforeLessons, listStrainedEnds } from "./kept-phase-ends";
import {
  type LandedUnits,
  findLanding,
  getLandingSkillMinutes,
  listLandedUnits,
} from "./landed-lessons";
import { listKeptTime, putLandedLessons } from "./landed-placement";
import { type LaidOutOrder, toQueueUnit } from "./learned-order";
import { placeItemsInPhaseTime } from "./phase-time";
import { type PlanBase } from "./plan-bases";
import { addDays, getEndOfWeek } from "./plan-calendar";
import { withMovedEvents } from "./plan-days";
import { getLastLessonDate, getPlanEvents } from "./plan-events";
import {
  type ExistingPlanItem,
  type PlannedItem,
  fromUnit,
  getItemKey,
  mergePlanItems,
} from "./plan-items";
import { type ExamWindow } from "./plan-phases";
import { buildPlanQueue } from "./plan-queue";
import { createDays, getCalendar, getHorizonDays, getPlanStart } from "./plan-run-days";
import { type PlanGraph, type PlanSettings, type StoredBaseChoice } from "./plan-state";
import { type PlannerLesson } from "./plan-units";
import { withoutRepeatedTitles } from "./repeated-titles";
import { type ScheduledEvent, listPlanDays } from "./schedule-units";
import { type SkillMinutes } from "./skill-minutes";
import { type SkillReadiness } from "./skill-order";
import { joinStandIns } from "./stand-in-parts";
import { type PlanOutline, summarizePlan } from "./summarize-plan";
import { layOutAfterThisWeek } from "./week-after";

/**
 * `forced` re-plans from today: the learner changed something, missed days, or took a test-out.
 * `automatic` keeps this week's items where they are and only moves what comes after, since this
 * week stays stable unless a change clearly helps.
 */
export type PlanningMode = "automatic" | "forced";

export type BuildPlanInput = {
  /**
   * What the questions a class test's own material announces ask ("Essay on osmosis"): a
   * plan short on time keeps the lessons on them (see `findAnnouncedLessonIds`). Absent for goals
   * without the learner's own material.
   */
  announcements?: readonly string[];
  /**
   * The skills any of the learner's answers missed, a test's or practice's, even when a later one
   * was right (see `listAnsweredWrong`): a plan short on time keeps them before topics asked as
   * often, and takes none of them as known. Absent: only `missedSkillIds` says what was missed.
   */
  answeredWrongSkillIds?: ReadonlySet<string>;
  /** The Library band the skill graph put each skill in, for a goal that isn't an exam's bases. */
  bands?: ReadonlyMap<string, CourseLevel>;
  /**
   * The plan's bases (see `findPlanBases`), each studied for its core unless the learner's choices
   * (`settings.baseChoices`) say otherwise: `graph` and `lessons` stay the whole skills', and a plan
   * with choices follows the order of the one with every base's core (see `followLearnedOrder`).
   * Absent for plans whose bases aren't known, which plan every skill whole.
   */
  bases?: readonly PlanBase[];
  /**
   * A learner's change: work set aside for time (see `setAsideLeftWork`) competes for the plan's
   * time again with the rest, back to do where it fits and set aside still where it doesn't. A class
   * test's organelles stayed set aside once the learner chose to study everything. Absent for
   * every other run: what a run set aside stays out until the learner changes the plan.
   */
  bringBackSetAside?: boolean;
  /**
   * A new day's settling, and any later run the same day: the work earlier days left comes first,
   * in the order it was planned, and the rest of the plan fills the days after it (see
   * `CarryOver`). Absent for an automatic run on a day that settled nothing.
   */
  carryOver?: CarryOver | null;
  /** The final stretch's mocks: the whole exam day, its written test included (`mockMinutes`). */
  fullMockMinutes?: number;
  goal: { dailyMinutes: number; kind: GoalKind; targetDate: Date | null };
  graph: PlanGraph;
  /**
   * The run's only news is lessons the Library wrote for the plan's stand-ins, those of skills the
   * plan holds lessons of included (their next chapters, see `readLanding`): they land too, in
   * their stand-in's place. Absent: such a skill doesn't land (see `findLanding`), and a stand-in
   * this week kept the time its next chapter was written for: the chapter waited for the week
   * after, behind the stand-in for the lessons after it and the phase's challenge.
   */
  heldSkillsLand?: boolean;
  items: readonly ExistingPlanItem[];
  /**
   * The exam's parts the learner said they already know (onboarding's known subjects, or past the
   * basics): an exam's study cycle opens with the others. Absent when they named none.
   */
  knownAreas?: ReadonlySet<string>;
  /**
   * The skills the learner showed they know, as the learner model and the syllabus say it (see
   * `isKnownClaim`): a plan short on time cuts them first (practice keeps them), and every topic
   * is in while each of the rest has lessons. Absent: the learner showed none.
   */
  knownSkillIds?: ReadonlySet<string>;
  /**
   * The run's only news is lessons the Library wrote for the plan's stand-ins: the rest of its input
   * is the one the plan was saved from (see `readLanding`). It keeps every other item as the plan
   * has it: planned again, the plan as saved disagreed with itself, and an OAB plan's next morning
   * swapped 10 lessons. Absent: a landing plans the plan as saved again (see `findLanding`).
   */
  landedOnly?: boolean;
  lessons: readonly PlannerLesson[];
  /** The band the learner's own level starts at (see `getLevelFloor`); null takes every band. */
  levelFloor?: CourseLevel | null;
  /**
   * The skills the learner's last answer in a test (placement, the focus test, a chapter test)
   * missed or didn't know: an exam's study cycle opens with their subjects.
   */
  missedSkillIds?: ReadonlySet<string>;
  /** The length of the exam's weekly mock in real conditions: half its first day. */
  mockMinutes: number;
  /**
   * The run moves or lets go phase ends the learner saw (Today's proposal to move them, see
   * `planPhaseDatesMove`): lessons written since for the plan's stand-ins are laid out as any
   * other work, so a moved end falls after them. Planned in their stand-ins' time instead (see
   * `findLanding`), they left the challenge where it was, and Today never offered to move it past
   * lessons that landed longer than planned. Absent for every other run.
   */
  movesPhaseEnds?: boolean;
  /**
   * The areas that are parts of the exam's notice, whose shares of it weigh the plan: an exam's
   * study cycle opens with them before areas beyond it (exam strategy). Null without a notice.
   */
  noticeAreas?: ReadonlySet<string> | null;
  mode: PlanningMode;
  paceFactor: number;
  /**
   * An exam's phases the learner sees, with their dates: a new exam date never ends the one they're
   * in before today (see `getKeptExamWindows`). Absent for a new plan.
   */
  examWindows?: readonly ExamWindow[];
  /**
   * The end dates of a learn plan's phases the learner saw, which a system refresh keeps (see
   * `keepPhaseEnds`). Absent when the run re-plans them: a learner's change, a new plan, an exam.
   */
  phaseEnds?: ReadonlyMap<number, Date>;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  /** Each base's quick lesson the Library has, for a base the learner studies with one. */
  quickLessons?: ReadonlyMap<string, PlannerLesson>;
  /**
   * A new day's settling: work earlier days left that the run can't place by the goal's date is set
   * aside (`skipped`) instead of leaving the plan (see `setAsideLeftWork`). Absent for every other
   * run: a learner's change plans what they asked for.
   */
  setAsideLeftWork?: boolean;
  readiness: ReadonlyMap<string, SkillReadiness>;
  settings: PlanSettings;
  /**
   * The areas the learner is doing well in. A plan made harder starts past their foundations;
   * only read then, so plans that aren't can leave it out.
   */
  strongAreas?: ReadonlySet<string>;
  /** The learner-local date. */
  today: Date;
  /**
   * Today's session was built: the learner was shown the day, so an automatic run puts on it no
   * more than the time its stand-ins held (see `putLandedLessons`). Absent when it wasn't.
   */
  todayShown?: boolean;
  /**
   * How often the exam asks its notice's topics (see `listTopicLevels`): a plan short on time keeps
   * the topics asked most. Absent for goals that aren't exams with a notice.
   */
  topicLevels?: readonly TopicLevel[];
};

export type BuiltPlan = PlanOutline & {
  /** Skills the plan can't cover whole before its deadline at this pace. */
  droppedSkillIds: string[];
  /**
   * The kept phase ends whose challenge comes before a lesson it tests (see
   * `listEndsBeforeLessons`), by phase: a missed day's settling lets them go.
   */
  endsBeforeLessons: number[];
  items: PlannedItem[];
  /**
   * The kept phase ends whose challenge stays on a day without room for it (see
   * `listStrainedEnds`), by phase: Today offers to move the phase dates.
   */
  strainedEnds: StrainedEnd[];
  /**
   * The units after this week as the plan laid them out, which a plan with base choices follows
   * (see `followLearnedOrder`).
   */
  order: LaidOutOrder;
  /** Each planned skill's minutes, covered and in all, for what share of the goal fits. */
  skillMinutes: SkillMinutes[];
  /**
   * The minutes this week's kept work takes past this week at the run's pace (see
   * `layOutAfterThisWeek`), none when it fits: a session's new pace that leaves it re-plans the
   * rest from tomorrow (see `refreshGoalPlan`).
   */
  spill: number;
  /**
   * Skills whose core doesn't fit before the deadline, so the plan doesn't reach them at all: only
   * when every other skill's core takes the time (see `putCoresFirst`).
   */
  waitingSkillIds: string[];
};

/**
 * Plans a goal from its skill graph, the Library's lessons for those skills and the learner's
 * time: the lessons in teaching order (an exam's as a study cycle of a few subjects a day; see
 * `arrangeStudyCycle`), phase checkpoints, weekly checkpoints or mocks, and review days, each with
 * a date. When the time before the deadline doesn't fit every lesson, every skill's core comes
 * first and the rest adds depth (see `putCoresFirst`), so no topic is left out while another gets
 * its depth. Finished work is never undone and an automatic run leaves this week alone. Each base
 * (`bases`) is studied for its core unless the learner chose another way (see `BaseChoice`): then
 * the plan takes the one with every base's core first and studies each as chosen in its place
 * (see `followLearnedOrder`), so no choice pushes out what that one keeps. That one is laid out
 * from today whatever the run: this week's items are the chosen plan's, and kept in it, a base's
 * core read as new work this week that a quick lesson had taken, so it laid itself out from the
 * week after and the plan following it lost lessons. An automatic run whose stand-ins' lessons
 * were written since plans the input as the plan was saved, and puts those lessons in their
 * stand-ins' time (see `findLanding`). Pure: the same inputs always give the same plan.
 */
export function buildPlan(given: BuildPlanInput): BuiltPlan {
  const landing = findLanding(given);
  const input = landing?.asSaved ?? given;
  const essential = withBaseChoices({ choices: [], input });

  const landedFor = (choices: StoredBaseChoice[]) =>
    landing && listLandedUnits({ input: withBaseChoices({ choices, input: given }), landing });

  const keepsRest = landing !== null && given.landedOnly === true;

  if (!hasBaseChoices(input)) {
    return planGoal({
      input: essential,
      keepsRest,
      landedUnits: landedFor([]),
      learnedOrder: null,
    });
  }

  const reference = planGoal({
    input: { ...essential, mode: "forced" },
    keepsRest: false,
    landedUnits: null,
    learnedOrder: null,
  });

  const choices = getKeptBaseChoices(input);
  const chosen = withBaseChoices({ choices, input });

  return planGoal({
    input: chosen,
    keepsRest,
    landedUnits: landedFor(choices),
    learnedOrder: reference.order,
  });
}

/**
 * A plan with a date keeps its weekly checkpoints until then, and the days after its last lesson
 * are practice days, so lessons that end weeks early never leave empty weeks before the date. A
 * test days away keeps its own short plan. A landing-only run keeps the plan's own (see
 * `landedOnly`).
 */
function listRunEvents({
  afterExam,
  keepsRest,
  start,
  ...planned
}: Parameters<typeof getPlanEvents>[0] & {
  afterExam: ReturnType<typeof continueAfterExam>;
  keepsRest: boolean;
  start: Date;
}): ScheduledEvent[] {
  if (keepsRest) {
    return [];
  }

  return [
    ...getPlanEvents(planned).filter((event) => event.date >= start),
    ...(afterExam?.events ?? []),
  ];
}

/**
 * Where new work starts when the run keeps nothing of this week: today, or tomorrow once an
 * automatic run finds today's work studied. A day the learner finished gets nothing on top, as a
 * session's new pace re-plans from tomorrow (see `refreshGoalPlan`): Pedro's only lesson done on a
 * Sunday, a refresh found the day free and added the week's checkpoint, 30 minutes on his 15.
 */
function getOpenStart(input: BuildPlanInput): Date {
  const today = input.today.getTime();

  const studiedToday =
    input.mode === "automatic" &&
    input.items.some((item) => item.status === "done" && item.scheduledFor?.getTime() === today);

  return studiedToday ? addDays(input.today, 1) : input.today;
}

/** `buildPlan` for one graph: its own order, or the one a plan with every base's core took. */
function planGoal({
  input,
  keepsRest,
  landedUnits,
  learnedOrder,
}: {
  input: BuildPlanInput;
  /** A landing-only run: every other item stays as the plan has it (see `landedOnly`). */
  keepsRest: boolean;
  /** A landing's skills' units (see `listLandedUnits`); null when nothing landed. */
  landedUnits: LandedUnits | null;
  learnedOrder: LaidOutOrder | null;
}): BuiltPlan {
  const planStart = getPlanStart(input);

  const { focused, prerequisites, ranks, rates, units: queue, values } = buildPlanQueue(input);

  const {
    finished,
    frozen,
    landed: landedStandIns,
    replaced,
    setAsideBefore,
    thisWeek,
  } = splitExistingItems({ input, keepsRest, landedSkillIds: landedUnits ?? undefined, queue });

  const unitsByKey = new Map(queue.map((unit) => [unit.key, unit]));
  const finishedKeys = new Set(finished.map((item) => getItemKey(item)));
  // New work starts after this week when the run keeps this week's work (see `getOpenStart`).
  const start = frozen.length > 0 ? addDays(getEndOfWeek(input.today), 1) : getOpenStart(input);
  const days = createDays({ input, planStart });
  const { windows } = days;

  const describeDay = withMovedEvents({
    describeDay: days.describeDay,
    moves: input.settings.movedEvents,
  });

  // Laid out from today, this week's kept work included, as the run that saved it laid it out: what
  // comes after this week starts where it did (see `keepThisWeek`).
  const planDays = listPlanDays({
    describeDay,
    horizonDays: getHorizonDays({ input, start: input.today }),
    start: input.today,
  });

  const unplaced = withoutRepeatedTitles({
    kept: finished,
    units: queue.filter((unit) => !finishedKeys.has(unit.key)),
  });

  // A learn plan's shown phase ends a system run keeps; an exam's phases are its calendar's.
  const phaseEnds = windows.length > 0 ? new Map() : (input.phaseEnds ?? new Map());

  // What earlier days left comes first, as it was planned; the rest fills the time after it.
  const { carriedSchedule, keptParts, keptUntil, restSchedule, spill, yielded } =
    layOutAfterThisWeek({
      days: planDays,
      kept: listThisWeekWork({
        frozen: [...frozen, ...landedStandIns],
        landed: [],
        units: unitsByKey,
      }),
      layOut: (laid) =>
        scheduleCarriedAndRest({
          ...laid,
          finished,
          input,
          learnedOrder,
          phaseEnds,
          planStart,
          queue: { focused, prerequisites, ranks, rates, values },
          unitsByKey,
        }),
      start,
      units: unplaced,
    });

  const { landed, laidOut, leftOut } = putLandedLessons({
    days: planDays,
    dropped: [...carriedSchedule.dropped, ...restSchedule.dropped],
    input,
    kept: keepsRest ? listKeptTime({ frozen, units: unitsByKey }) : null,
    keptParts,
    landed: landedUnits,
    start,
    units: [...carriedSchedule.units, ...restSchedule.units],
  });

  const schedule = keepThisWeek({
    days: planDays,
    frozen,
    landed,
    schedule: {
      dropped: [...carriedSchedule.dropped, ...restSchedule.dropped, ...leftOut],
      events: restSchedule.events,
      units: laidOut,
    },
    start,
  });

  const afterExam = continueAfterExam({
    before: schedule.units,
    calendar: getCalendar(input),
    dropped: schedule.dropped,
    goal: input.goal,
    mockMinutes: input.mockMinutes,
    phase: windows.length,
    settings: input.settings,
    start,
  });

  const events = listRunEvents({
    afterExam,
    days: planDays,
    events: schedule.events,
    input,
    keepsRest,
    lastLessonDate: getLastLessonDate({ kept: thisWeek, keptUntil, units: schedule.units }),
    lastUnitDate: schedule.units.at(-1)?.date ?? null,
    planStart,
    start,
  });

  // This week keeps its order: a stand-in's outlined lessons take its place in it. A landing-only
  // run keeps every day's: its lessons past this week came after every other item of their day.
  const outlined = (keepsRest ? [...landed, ...laidOut] : landed).filter((unit) => unit.lessonId);
  const landedBySkill = Map.groupBy(outlined, (unit) => unit.skillId ?? "");

  const units = joinStandIns([...schedule.units, ...(afterExam?.units ?? [])]);
  const placedKeys = new Set(units.map((unit) => unit.key));

  // Work set aside before that the run doesn't place stays as it was (see `bringBackSetAside`).
  const stillAside = setAsideBefore.filter((item) => !placedKeys.has(getItemKey(item)));

  const kept = [...finished, ...stillAside, ...thisWeek].flatMap((item) =>
    landedStandIns.includes(item)
      ? (landedBySkill.get(item.skillId ?? "") ?? []).map((unit) => fromUnit(unit))
      : [toKeptItem({ input, item, units: unitsByKey, windows })],
  );

  const setAside = setAsideLeftWork({ input, placed: [...kept, ...units], yielded });
  const merged = mergePlanItems({ events, kept: [...kept, ...setAside], replaced, units });
  const dropped = afterExam?.dropped ?? schedule.dropped;

  // An exam's lessons already belong to the phase of the day they're due; a learn plan's late ones
  // (depth studied once every core is in) join the phase whose time they fall in.
  const items =
    windows.length > 0 ? merged : placeItemsInPhaseTime({ items: merged, kept: phaseEnds });

  return {
    ...summarizePlan({
      afterExam: afterExam?.span,
      graph: input.graph,
      items,
      kept: phaseEnds,
      queue: [...queue.filter((unit) => finishedKeys.has(unit.key)), ...unplaced],
      scheduleStart: start,
      windows,
    }),
    droppedSkillIds: [...new Set(dropped.flatMap((unit) => (unit.skillId ? [unit.skillId] : [])))],
    endsBeforeLessons: listEndsBeforeLessons({ ends: phaseEnds, input, items, units: laidOut }),
    items,
    order: {
      dropped: restSchedule.dropped.map((unit) => toQueueUnit(unit)),
      placed: restSchedule.units.map((unit) => toQueueUnit(unit)),
    },
    skillMinutes: getLandingSkillMinutes({
      dropped: [...dropped, ...listKeptStandInCuts({ frozen, units: unitsByKey })],
      kept: queue.filter((unit) => finishedKeys.has(unit.key)),
      landed: landedUnits,
      pending: unplaced,
    }),
    spill,
    strainedEnds: listStrainedEnds({ days: planDays, ends: phaseEnds, units: laidOut }),
    waitingSkillIds: [
      ...new Set(dropped.flatMap((unit) => (unit.skillId && !unit.depth ? [unit.skillId] : []))),
    ],
  };
}
