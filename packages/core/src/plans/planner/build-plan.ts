import { type CourseLevel, type GoalKind } from "@zoonk/db";
import { type TopicLevel } from "../../library/exams/topic-frequency";
import { listAfterExamDays } from "./after-exam";
import { type BossMinutes } from "./boss-minutes";
import { type BuiltPlan } from "./built-plan";
import { type CarryOver } from "./carry-over";
import { getKeptBaseChoices, hasBaseChoices, withBaseChoices } from "./chosen-bases";
import { listEndsBeforeLessons } from "./ends-before-lessons";
import { type ExamBossDays, listBossDayFacts } from "./exam-boss-days";
import { type PlanExtraInput, appendExamExtras, withoutExamExtras } from "./exam-extras";
import { listLessonDays } from "./interval-study-minutes";
import { keepThisWeek, listKeptStandInCuts, setAsideLeftWork, toKeptItem } from "./kept-items";
import { listStrainedEnds } from "./kept-phase-ends";
import { type Landing, findLanding } from "./landed-lessons";
import { placeLandedLessons, reservePlaced, withoutPlaced } from "./landed-placement";
import { type LaidOutOrder, toLaidOutOrder } from "./learned-order";
import { type MockClock, type MockResolution } from "./mock-identity";
import { createLayOut } from "./pass-layout";
import {
  listChallengesLeftOut,
  listTaughtPhases,
  withoutUntestableChallenges,
} from "./phase-checkpoints";
import { placeItemsInPhaseTime } from "./phase-time";
import { type PlanBase } from "./plan-bases";
import { getLastLessonDate, scheduleRunEvents } from "./plan-events";
import { type ExistingPlanItem, fromUnit, mergePlanItems } from "./plan-items";
import { type ExamWindow } from "./plan-phases";
import { getPlanStart } from "./plan-run-days";
import { type PlanGraph, type PlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";
import { preparePlanWork } from "./plan-work";
import { type BossPlanFacts, settlePlannedBosses } from "./planned-bosses";
import { resolvePlannedMocks, settlePlannedMocks } from "./planned-mocks";
import { getSkillMinutes } from "./skill-minutes";
import { type MockMiss, type SkillReadiness } from "./skill-order";
import { joinStandIns } from "./stand-in-parts";
import { listDroppedSkills, summarizePlan } from "./summarize-plan";
import { getLastKeptDay, listStillSetAside, withTestOutsAhead } from "./this-week-items";
import { listThisWeekWork } from "./this-week-work";
import { markKeptLessons } from "./whole-boss";
import { type PlanWriting } from "./writing-allocation";

/**
 * `forced` re-plans from today; `automatic` keeps this week's items where they are and moves only
 * what comes after.
 */
export type PlanningMode = "automatic" | "forced";

export type BuildPlanInput = {
  bossFacts?: BossPlanFacts;
  bossMinutes?: BossMinutes;
  bossDays?: ExamBossDays;
  announcements?: readonly string[];
  answeredWrongSkillIds?: ReadonlySet<string>;
  bands?: ReadonlyMap<string, CourseLevel>;
  bases?: readonly PlanBase[];
  bringBackSetAside?: boolean;
  carryOver?: CarryOver | null;
  fullMockMinutes?: number;
  goal: { dailyMinutes: number; kind: GoalKind; targetDate: Date | null };
  goalId?: string;
  graph: PlanGraph;
  heldSkillsLand?: boolean;
  items: readonly ExistingPlanItem[];
  knownAreas?: ReadonlySet<string>;
  knownSkillIds?: ReadonlySet<string>;
  landedOnly?: boolean;
  lessons: readonly PlannerLesson[];
  levelFloor?: CourseLevel | null;
  missedSkillIds?: ReadonlySet<string>;
  mockClocks?: readonly MockClock[];
  mockMinutes: number;
  /** The topics the latest mock missed, while the plan follows that mock (`settings.mockReplan`). */
  mockMisses?: ReadonlyMap<string, MockMiss>;
  movesPhaseEnds?: boolean;
  noticeAreas?: ReadonlySet<string> | null;
  mode: PlanningMode;
  /** The plan items of the day the learner opened, which stay whole on today. */
  openedKeys?: readonly string[];
  paceFactor: number;
  examWindows?: readonly ExamWindow[];
  extras?: PlanExtraInput;
  finishedOn?: ReadonlyMap<string, Date>;
  phaseEnds?: ReadonlyMap<number, Date>;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  quickLessons?: ReadonlyMap<string, PlannerLesson>;
  setAsideLeftWork?: boolean;
  readiness: ReadonlyMap<string, SkillReadiness>;
  settings: PlanSettings;
  /** The lesson already being written for the learner to open first, which stays first while the plan holds it. */
  startLessonId?: string | null;
  strongAreas?: ReadonlySet<string>;
  today: Date;
  todayShown?: boolean;
  topicLevels?: readonly TopicLevel[];
  writing?: PlanWriting;
};

export type { BuiltPlan } from "./built-plan";

/** Pure: the same inputs always give the same plan. */
export function buildPlan(given: BuildPlanInput) {
  const input = withoutExamExtras(withTestOutsAhead(given));

  const built = settlePlannedBosses({ build: buildWithBosses, input });

  return appendExamExtras({
    built: withoutUntestableChallenges({ built, input }),
    input,
    requested: given,
  });
}

function buildWithBosses(input: BuildPlanInput): BuiltPlan {
  const landing = findLanding(input);
  const essential = withBaseChoices({ choices: [], input });

  if (!hasBaseChoices(input)) {
    return resolvePlannedMocks((resolution) =>
      planGoal({ input: essential, landing, learnedOrder: null, resolution }),
    );
  }

  const reference = resolvePlannedMocks((resolution) =>
    planGoal({
      input: { ...essential, mode: "forced" },
      landing: null,
      learnedOrder: null,
      resolution,
    }),
  );

  const chosen = withBaseChoices({ choices: getKeptBaseChoices(input), input });

  return resolvePlannedMocks((resolution) =>
    planGoal({ input: chosen, landing, learnedOrder: reference.order, resolution }),
  );
}

function planGoal({
  input,
  landing,
  learnedOrder,
  resolution,
}: {
  input: BuildPlanInput;
  landing: Landing | null;
  learnedOrder: LaidOutOrder | null;
  resolution: MockResolution | null;
}): BuiltPlan {
  const planStart = getPlanStart(input);

  const work = preparePlanWork({ input, landing, planStart, resolution });
  const { funded, keepsRest, landedUnits, priorities, queue, start, unitsByKey, windows } = work;

  const {
    finished,
    frozen,
    landed: landedStandIns,
    replaced,
    setAsideBefore,
    thisWeek,
  } = work.split;

  const end = getLastKeptDay({ input, keepsRest });

  const landed = placeLandedLessons({
    days: funded.days,
    end,
    frozen,
    input,
    landed: landedUnits,
    units: work.limited,
    unitsByKey,
  });

  const keptWork = [...finished, ...thisWeek, ...frozen, ...landed.kept];
  const pending = markKeptLessons({ input, kept: keptWork, units: work.limited });

  const phaseEnds = windows.length > 0 ? new Map() : (input.phaseEnds ?? new Map());

  const { carriedSchedule, keptPortions, keptUntil, restSchedule, spill, yielded } = createLayOut({
    input,
    // A landing's lessons are placed outside the layout, so the week it lays out isn't the saved one.
    keepsSavedDays: landedUnits !== null,
    kept: keptWork,
    learnedOrder,
    phaseEnds,
    planStart,
    queue: priorities,
    start,
    thisWeek: listThisWeekWork({ end, frozen, today: input.today, units: unitsByKey }),
    units: withoutPlaced({ placed: [...landed.placed, ...landed.dropped], units: pending }),
    unitsByKey,
  })(reservePlaced({ days: funded.days, placed: landed.placed }));

  // A run that keeps the rest lays nothing else out: every other item stays as it was saved.
  const placed = keepsRest ? [] : [...carriedSchedule.units, ...restSchedule.units];
  const taught = listTaughtPhases({ kept: keptWork, landed: landed.placed, units: placed });
  const laidOut = placed.filter((unit) => unit.kind !== "boss" || taught.has(unit.phase));

  const schedule = keepThisWeek({
    days: funded.days,
    frozen,
    landed: landed.placed,
    schedule: {
      dropped: [...carriedSchedule.dropped, ...restSchedule.dropped, ...landed.dropped],
      events: restSchedule.events,
      units: laidOut,
    },
    start,
  });

  const droppedBeforeExam = [...schedule.dropped, ...work.deferred];

  const { afterExam, spare } = scheduleRunEvents({
    days: funded.days,
    funded,
    input,
    keepsRest,
    lastLessonDate: getLastLessonDate({ kept: thisWeek, keptUntil, units: schedule.units }),
    planStart,
    resolution,
    schedule: { ...schedule, dropped: droppedBeforeExam },
    start,
    windows,
  });

  const units = joinStandIns([...schedule.units, ...(afterExam?.units ?? [])]);

  const stillAside = listStillSetAside({ items: setAsideBefore, placed: units });

  const kept = [...finished, ...stillAside, ...thisWeek].flatMap((item) =>
    landedStandIns.includes(item)
      ? (landed.lessons.get(item.skillId ?? "") ?? []).map((unit) => fromUnit(unit))
      : [toKeptItem({ input, item, units: unitsByKey, windows })],
  );

  const setAside = setAsideLeftWork({ input, placed: [...kept, ...units], queue, yielded });

  const merged = mergePlanItems({
    events: spare.events,
    kept: [...kept, ...setAside],
    replaced,
    units,
  });

  const dropped = afterExam?.dropped ?? droppedBeforeExam;

  const challengeDays = [...funded.days, ...listAfterExamDays(afterExam)].filter(
    (day) => day.date >= start,
  );

  const items =
    windows.length > 0 ? merged : placeItemsInPhaseTime({ items: merged, kept: phaseEnds });

  const mocks = settlePlannedMocks({
    afterExam: afterExam?.funded ?? null,
    clocks: input.mockClocks,
    dayPass: funded,
    items,
    resolution,
    saved: input.settings.mockFunding,
    spare,
    today: input.today,
  });

  const { skillLessons, ...outline } = summarizePlan({
    afterExam: afterExam?.span ?? null,
    challengesLeftOut: listChallengesLeftOut({ dropped, items, taught }),
    graph: input.graph,
    items,
    kept: phaseEnds,
    queue: [...queue.filter((unit) => work.finishedKeys.has(unit.key)), ...pending],
    scheduleStart: start,
    windows,
    writingSchedule: work.writing.writingSchedule,
  });

  return {
    ...outline,
    skillLessons,
    ...listDroppedSkills(dropped),
    endsBeforeLessons: listEndsBeforeLessons({
      given: input,
      items,
      laidOut,
      phaseEnds,
      skillLessons,
    }),
    items,
    keptKeys: new Set([...kept, ...setAside].map((item) => item.key)),
    ...listLessonDays(units, keptPortions),
    mockFunding: mocks.mockFunding,
    mocks,
    order: toLaidOutOrder(restSchedule),
    planDays: funded.days,
    skillMinutes: getSkillMinutes({
      dropped: [...dropped, ...listKeptStandInCuts({ frozen, units: unitsByKey })],
      kept: queue.filter((unit) => work.finishedKeys.has(unit.key)),
      pending: [...pending, ...work.deferred],
    }),
    spill,
    strainedEnds: listStrainedEnds({ days: funded.days, ends: phaseEnds, units: laidOut }),
    ...work.writing,
    ...listBossDayFacts({ days: challengeDays, input, kept: keptPortions, units }),
  };
}
