import { type CourseLevel, type GoalKind } from "@zoonk/db";
import { type TopicLevel } from "../../library/exams/topic-frequency";
import { listAfterExamDays } from "./after-exam";
import { type BossMinutes } from "./boss-minutes";
import { type BuiltPlan } from "./built-plan";
import { type CarryOver } from "./carry-over";
import { getKeptBaseChoices, hasBaseChoices, withBaseChoices } from "./chosen-bases";
import { type ExamBossDays, listBossDayFacts } from "./exam-boss-days";
import { listLessonDays } from "./interval-study-minutes";
import {
  keepThisWeek,
  listKeptStandInCuts,
  listThisWeekWork,
  setAsideLeftWork,
  splitExistingItems,
} from "./kept-items";
import { listEndsBeforeLessons, listStrainedEnds } from "./kept-phase-ends";
import {
  type LandedUnits,
  findLanding,
  getLandingSkillMinutes,
  listLandedUnits,
} from "./landed-lessons";
import { listKeptTime, putLandedLessons } from "./landed-placement";
import { type LaidOutOrder, toQueueUnit } from "./learned-order";
import { layOutSelectedMove } from "./local-mock-move-layout";
import { type MockClock, type MockResolution } from "./mock-identity";
import { createLayOut } from "./pass-layout";
import { placeItemsInPhaseTime } from "./phase-time";
import { keepSelectedItem } from "./pinned-study-portions";
import { type PlanBase } from "./plan-bases";
import { addDays, getEndOfWeek } from "./plan-calendar";
import { getLastLessonDate, scheduleRunEvents } from "./plan-events";
import { type ExistingPlanItem, fromUnit, mergePlanItems } from "./plan-items";
import { type ExamWindow } from "./plan-phases";
import { createDays, getOpenStart, getPlanStart, listFundedPlanDays } from "./plan-run-days";
import { type PlanGraph, type PlanSettings, type StoredBaseChoice } from "./plan-state";
import { type PlannerLesson } from "./plan-units";
import { type BossPlanFacts, settlePlannedBosses } from "./planned-bosses";
import { resolvePlannedMocks, settlePlannedMocks } from "./planned-mocks";
import { type SkillReadiness } from "./skill-order";
import { joinStandIns } from "./stand-in-parts";
import { summarizePlan } from "./summarize-plan";
import {
  getKeptAfterExamSpan,
  getPendingOrder,
  getRunQueue,
  listStillSetAside,
} from "./this-week-items";
import { markKeptLessons } from "./whole-boss";

/**
 * `forced` re-plans from today: the learner changed something, missed days, or took a test-out.
 * `automatic` keeps this week's items where they are and only moves what comes after, since this
 * week stays stable unless a change clearly helps.
 */
export type PlanningMode = "automatic" | "forced";

export type BuildPlanInput = {
  /** What the plan's bosses ask (see `settlePlannedBosses`); absent: their size before the bank. */
  bossFacts?: BossPlanFacts;
  bossMinutes?: BossMinutes;
  /** Where an exam's phase challenges go, as a run places them (see `settlePlannedBosses`). */
  bossDays?: ExamBossDays;
  /** A new course's first day fills its study time with lessons before later days reserve practice. */
  courseStart?: boolean;
  /** The days the change being planned moves the week's events to (see `fundMocks`). */
  requestedMoveDates?: ReadonlySet<string>;
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
  /** The goal the run plans, for its warnings only (see `settlePlannedBosses`). */
  goalId?: string;
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
  /** A move-only edit keeps saved membership, dates and committed mock funding. */
  keepSelection?: boolean;
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
  /**
   * Each exam day's mock clock, in the order the plan's mocks take turns (see `MockClock`). Absent
   * outside exams' runs: every mock then takes `mockMinutes` (all of the day: `fullMockMinutes`).
   */
  mockClocks?: readonly MockClock[];
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
   * The learner's own day each finished lesson of the plan was done, by item id (see
   * `listFinishedDays`): its challenge comes after that day, not the one the plan had it on.
   */
  finishedOn?: ReadonlyMap<string, Date>;
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

export type { BuiltPlan } from "./built-plan";

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
export function buildPlan(given: BuildPlanInput) {
  return settlePlannedBosses({ build: buildWithBosses, input: given });
}

function buildWithBosses(given: BuildPlanInput): BuiltPlan {
  const landing = given.keepSelection ? null : findLanding(given);

  const input = landing?.asSaved ?? given;

  const essential = withBaseChoices({ choices: [], input });

  const landedFor = (choices: StoredBaseChoice[]) =>
    landing && listLandedUnits({ input: withBaseChoices({ choices, input: given }), landing });

  const keepsRest = given.keepSelection === true || (landing !== null && given.landedOnly === true);

  if (!hasBaseChoices(input)) {
    return resolvePlannedMocks((resolution) =>
      planGoal({
        input: essential,
        keepsRest,
        landedUnits: landedFor([]),
        learnedOrder: null,
        resolution,
      }),
    );
  }

  const reference = resolvePlannedMocks((resolution) =>
    planGoal({
      input: { ...essential, mode: "forced" },
      keepsRest: false,
      landedUnits: null,
      learnedOrder: null,
      resolution,
    }),
  );

  const choices = getKeptBaseChoices(input);
  const chosen = withBaseChoices({ choices, input });

  return resolvePlannedMocks((resolution) =>
    planGoal({
      input: chosen,
      keepsRest,
      landedUnits: landedFor(choices),
      learnedOrder: reference.order,
      resolution,
    }),
  );
}

/** `buildPlan` for one graph: its own order, or the one a plan with every base's core took. */
/**
 * The skills a run leaves out (`droppedSkillIds`), and those of them whose core it doesn't reach at
 * all (`waitingSkillIds`, see `BuiltPlan`).
 */
function listDroppedSkills(dropped: readonly { depth?: boolean; skillId: string | null }[]) {
  return {
    droppedSkillIds: [...new Set(dropped.flatMap((unit) => (unit.skillId ? [unit.skillId] : [])))],
    waitingSkillIds: [
      ...new Set(dropped.flatMap((unit) => (unit.skillId && !unit.depth ? [unit.skillId] : []))),
    ],
  };
}

function planGoal({
  input,
  keepsRest,
  landedUnits,
  learnedOrder,
  resolution,
}: {
  input: BuildPlanInput;
  /** A landing-only run: every other item stays as the plan has it (see `landedOnly`). */
  keepsRest: boolean;
  /** A landing's skills' units (see `listLandedUnits`); null when nothing landed. */
  landedUnits: LandedUnits | null;
  learnedOrder: LaidOutOrder | null;
  /** What earlier passes settled about the run's mocks (see `resolvePlannedMocks`). */
  resolution: MockResolution | null;
}): BuiltPlan {
  const planStart = getPlanStart(input);

  const { focused, prerequisites, ranks, rates, units: queue, values } = getRunQueue(input);

  const {
    finished,
    frozen,
    landed: landedStandIns,
    replaced,
    setAsideBefore,
    thisWeek,
  } = splitExistingItems({ input, keepsRest, landedSkillIds: landedUnits ?? undefined, queue });

  const { finishedKeys, ordered, unitsByKey } = getPendingOrder({ finished, queue });
  // New work starts after this week when the run keeps this week's work (see `getOpenStart`).
  const start = frozen.length > 0 ? addDays(getEndOfWeek(input.today), 1) : getOpenStart(input);
  const days = createDays({ input, planStart });

  // Laid out from today, this week's kept work included, as the run that saved it laid it out: what
  // comes after this week starts where it did (see `keepThisWeek`).
  const funded = listFundedPlanDays({ days, input, resolution, start, units: queue });

  const keptWork = [...finished, ...thisWeek, ...frozen];
  const unplaced = markKeptLessons({ input, kept: keptWork, units: ordered });

  // A learn plan's shown phase ends a system run keeps; an exam's phases are its calendar's.
  const phaseEnds = days.windows.length > 0 ? new Map() : (input.phaseEnds ?? new Map());

  // What earlier days left comes first, as it was planned; the rest fills the time after it.
  const { carriedSchedule, keptParts, keptPortions, keptUntil, restSchedule, spill, yielded } =
    createLayOut({
      input,
      kept: keptWork,
      learnedOrder,
      phaseEnds,
      planStart,
      queue: { focused, prerequisites, ranks, rates, values },
      start,
      thisWeek: listThisWeekWork({
        frozen: [...frozen, ...landedStandIns],
        landed: [],
        units: unitsByKey,
      }),
      units: unplaced,
      unitsByKey,
    })(funded.days);

  const { landed, laidOut, leftOut } = putLandedLessons({
    days: funded.days,
    dropped: [...carriedSchedule.dropped, ...restSchedule.dropped],
    input,
    kept: keepsRest ? listKeptTime({ frozen, units: unitsByKey }) : null,
    keptParts,
    landed: landedUnits,
    start,
    units: [...carriedSchedule.units, ...restSchedule.units],
  });

  const schedule = keepThisWeek({
    days: funded.days,
    frozen,
    landed,
    schedule: {
      dropped: [...carriedSchedule.dropped, ...restSchedule.dropped, ...leftOut],
      events: restSchedule.events,
      units: laidOut,
    },
    start,
  });

  const { afterExam, spare } = scheduleRunEvents({
    days: funded.days,
    funded,
    input,
    keepsRest,
    lastLessonDate: getLastLessonDate({ kept: thisWeek, keptUntil, units: schedule.units }),
    planStart,
    resolution,
    schedule,
    start,
    windows: days.windows,
  });

  // This week keeps its order: a stand-in's outlined lessons take its place in it. A landing-only
  // run keeps every day's: its lessons past this week came after every other item of their day.
  const outlined = (keepsRest ? [...landed, ...laidOut] : landed).filter((unit) => unit.lessonId);
  const landedBySkill = Map.groupBy(outlined, (unit) => unit.skillId ?? "");

  const units = joinStandIns([...schedule.units, ...(afterExam?.units ?? [])]);

  // Work set aside before that the run doesn't place stays as it was (see `bringBackSetAside`).
  const stillAside = listStillSetAside({ items: setAsideBefore, placed: units });

  const kept = [...finished, ...stillAside, ...thisWeek].flatMap((item) =>
    landedStandIns.includes(item)
      ? (landedBySkill.get(item.skillId ?? "") ?? []).map((unit) => fromUnit(unit))
      : [keepSelectedItem({ input, item, units: unitsByKey, windows: days.windows })],
  );

  const setAside = setAsideLeftWork({ input, placed: [...kept, ...units], yielded });

  const merged = layOutSelectedMove({
    days: funded.days,
    input,
    items: mergePlanItems({ events: spare.events, kept: [...kept, ...setAside], replaced, units }),
    portions: keptPortions,
    practiceFunding: funded.practiceFunding,
    units: unitsByKey,
  });

  const dropped = afterExam?.dropped ?? schedule.dropped;
  const planDays = merged.planDays ? [...merged.planDays] : funded.days;
  const challengeDays = [...planDays, ...listAfterExamDays(afterExam)];

  // An exam's lessons already belong to the phase of the day they're due; a learn plan's late ones
  // (depth studied once every core is in) join the phase whose time they fall in.
  const items =
    days.windows.length > 0
      ? merged.items
      : placeItemsInPhaseTime({ items: merged.items, kept: phaseEnds });

  const mocks = settlePlannedMocks({
    afterExam: afterExam?.funded ?? null,
    clocks: input.mockClocks,
    dayPass: funded,
    items,
    resolution,
    saved: input.settings.mockFunding,
    selectionShifts: merged.selectionShifts,
    spare,
    today: input.today,
  });

  return {
    ...summarizePlan({
      afterExam:
        afterExam?.span ?? getKeptAfterExamSpan({ input, items, portions: merged.portions }),
      graph: input.graph,
      items,
      kept: phaseEnds,
      queue: [...queue.filter((unit) => finishedKeys.has(unit.key)), ...unplaced],
      scheduleStart: start,
      windows: days.windows,
    }),
    ...listDroppedSkills(dropped),
    endsBeforeLessons: listEndsBeforeLessons({ ends: phaseEnds, input, items, units: laidOut }),
    items,
    keptKeys: new Set([...kept, ...setAside].map((item) => item.key)),
    ...listLessonDays(units, merged.portions),
    mockFunding: mocks.mockFunding,
    mocks,
    order: {
      dropped: restSchedule.dropped.map((unit) => toQueueUnit(unit)),
      placed: restSchedule.units.map((unit) => toQueueUnit(unit)),
    },
    planDays,
    skillMinutes: getLandingSkillMinutes({
      dropped: [...dropped, ...listKeptStandInCuts({ frozen, units: unitsByKey })],
      kept: queue.filter((unit) => finishedKeys.has(unit.key)),
      landed: landedUnits,
      pending: unplaced,
    }),
    spill,
    strainedEnds: listStrainedEnds({ days: planDays, ends: phaseEnds, units: laidOut }),
    ...listBossDayFacts({ days: challengeDays, input, kept: merged.portions, units }),
  };
}
