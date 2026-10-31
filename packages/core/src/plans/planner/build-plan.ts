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
  toKeptItem,
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
import { type MockClock, type MockResolution } from "./mock-identity";
import { createLayOut } from "./pass-layout";
import { listChallengesLeftOut, listTaughtPhases } from "./phase-checkpoints";
import { placeItemsInPhaseTime } from "./phase-time";
import { type PlanBase } from "./plan-bases";
import { addDays, getEndOfWeek } from "./plan-calendar";
import { getLastLessonDate, scheduleRunEvents } from "./plan-events";
import { type ExistingPlanItem, fromUnit, mergePlanItems } from "./plan-items";
import { type ExamWindow } from "./plan-phases";
import { buildPlanQueue } from "./plan-queue";
import { createDays, getOpenStart, getPlanStart, listFundedPlanDays } from "./plan-run-days";
import { type PlanGraph, type PlanSettings, type StoredBaseChoice } from "./plan-state";
import { type PlannerLesson } from "./plan-units";
import { type BossPlanFacts, settlePlannedBosses } from "./planned-bosses";
import { resolvePlannedMocks, settlePlannedMocks } from "./planned-mocks";
import { type SkillReadiness } from "./skill-order";
import { joinStandIns } from "./stand-in-parts";
import { summarizePlan } from "./summarize-plan";
import { getPendingOrder, listStillSetAside } from "./this-week-items";
import { markKeptLessons } from "./whole-boss";

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
  movesPhaseEnds?: boolean;
  noticeAreas?: ReadonlySet<string> | null;
  mode: PlanningMode;
  paceFactor: number;
  examWindows?: readonly ExamWindow[];
  finishedOn?: ReadonlyMap<string, Date>;
  phaseEnds?: ReadonlyMap<number, Date>;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  quickLessons?: ReadonlyMap<string, PlannerLesson>;
  setAsideLeftWork?: boolean;
  readiness: ReadonlyMap<string, SkillReadiness>;
  settings: PlanSettings;
  strongAreas?: ReadonlySet<string>;
  today: Date;
  todayShown?: boolean;
  topicLevels?: readonly TopicLevel[];
};

export type { BuiltPlan } from "./built-plan";

/** Pure: the same inputs always give the same plan. */
export function buildPlan(given: BuildPlanInput) {
  return settlePlannedBosses({ build: buildWithBosses, input: given });
}

function buildWithBosses(given: BuildPlanInput): BuiltPlan {
  const landing = findLanding(given);

  const input = landing?.asSaved ?? given;

  const essential = withBaseChoices({ choices: [], input });

  const landedFor = (choices: StoredBaseChoice[]) =>
    landing && listLandedUnits({ input: withBaseChoices({ choices, input: given }), landing });

  const keepsRest = landing !== null && given.landedOnly === true;

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
  keepsRest: boolean;
  landedUnits: LandedUnits | null;
  learnedOrder: LaidOutOrder | null;
  resolution: MockResolution | null;
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

  const { finishedKeys, ordered, unitsByKey } = getPendingOrder({ finished, queue });
  const start = frozen.length > 0 ? addDays(getEndOfWeek(input.today), 1) : getOpenStart(input);
  const days = createDays({ input, planStart });

  const funded = listFundedPlanDays({ days, input, resolution, start, units: queue });

  const keptWork = [...finished, ...thisWeek, ...frozen];
  const unplaced = markKeptLessons({ input, kept: keptWork, units: ordered });

  const phaseEnds = days.windows.length > 0 ? new Map() : (input.phaseEnds ?? new Map());

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

  const {
    dropped: leftOut,
    landed,
    laidOut: placed,
  } = putLandedLessons({
    days: funded.days,
    dropped: [...carriedSchedule.dropped, ...restSchedule.dropped],
    input,
    kept: keepsRest ? listKeptTime({ frozen, units: unitsByKey }) : null,
    keptParts,
    landed: landedUnits,
    start,
    units: [...carriedSchedule.units, ...restSchedule.units],
  });

  const taught = listTaughtPhases({ kept: keptWork, landed, units: placed });
  const laidOut = placed.filter((unit) => unit.kind !== "boss" || taught.has(unit.phase));

  const schedule = keepThisWeek({
    days: funded.days,
    frozen,
    landed,
    schedule: { dropped: leftOut, events: restSchedule.events, units: laidOut },
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

  const outlined = (keepsRest ? [...landed, ...laidOut] : landed).filter((unit) => unit.lessonId);
  const landedBySkill = Map.groupBy(outlined, (unit) => unit.skillId ?? "");

  const units = joinStandIns([...schedule.units, ...(afterExam?.units ?? [])]);

  const stillAside = listStillSetAside({ items: setAsideBefore, placed: units });

  const kept = [...finished, ...stillAside, ...thisWeek].flatMap((item) =>
    landedStandIns.includes(item)
      ? (landedBySkill.get(item.skillId ?? "") ?? []).map((unit) => fromUnit(unit))
      : [toKeptItem({ input, item, units: unitsByKey, windows: days.windows })],
  );

  const setAside = setAsideLeftWork({ input, placed: [...kept, ...units], yielded });

  const merged = mergePlanItems({
    events: spare.events,
    kept: [...kept, ...setAside],
    replaced,
    units,
  });

  const dropped = afterExam?.dropped ?? schedule.dropped;
  const planDays = funded.days;

  const challengeDays = [...planDays, ...listAfterExamDays(afterExam)].filter(
    (day) => day.date >= start,
  );

  const items =
    days.windows.length > 0 ? merged : placeItemsInPhaseTime({ items: merged, kept: phaseEnds });

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

  return {
    ...summarizePlan({
      afterExam: afterExam?.span ?? null,
      challengesLeftOut: listChallengesLeftOut({ dropped, items, taught }),
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
    ...listLessonDays(units, keptPortions),
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
    ...listBossDayFacts({ days: challengeDays, input, kept: keptPortions, units }),
  };
}
