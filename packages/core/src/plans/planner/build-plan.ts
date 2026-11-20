import { type CourseLevel, type GoalKind } from "@zoonk/db";
import { type TopicLevel } from "../../library/exams/topic-frequency";
import { listAfterExamDays } from "./after-exam";
import { type BossMinutes } from "./boss-minutes";
import { type BuiltPlan } from "./built-plan";
import { type CarryOver } from "./carry-over";
import { getKeptBaseChoices, hasBaseChoices, withBaseChoices } from "./chosen-bases";
import { listEndsBeforeLessons } from "./ends-before-lessons";
import { type ExamBossDays, listBossDayFacts } from "./exam-boss-days";
import { listLessonDays } from "./interval-study-minutes";
import {
  keepThisWeek,
  listKeptStandInCuts,
  listThisWeekWork,
  setAsideLeftWork,
  toKeptItem,
} from "./kept-items";
import { listStrainedEnds } from "./kept-phase-ends";
import {
  type LandedUnits,
  findLanding,
  getLandingSkillMinutes,
  listLandedUnits,
  withoutRepeatedLandings,
} from "./landed-lessons";
import { listKeptTime, putLandedLessons } from "./landed-placement";
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
import { type PlanGraph, type PlanSettings, type StoredBaseChoice } from "./plan-state";
import { type PlannerLesson } from "./plan-units";
import { preparePlanWork } from "./plan-work";
import { type BossPlanFacts, settlePlannedBosses } from "./planned-bosses";
import { resolvePlannedMocks, settlePlannedMocks } from "./planned-mocks";
import { type SkillReadiness } from "./skill-order";
import { joinStandIns } from "./stand-in-parts";
import { listDroppedSkills, summarizePlan } from "./summarize-plan";
import { listStillSetAside } from "./this-week-items";
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
  movesPhaseEnds?: boolean;
  noticeAreas?: ReadonlySet<string> | null;
  mode: PlanningMode;
  /** The plan items of the day the learner opened, which stay whole on today. */
  openedKeys?: readonly string[];
  paceFactor: number;
  examWindows?: readonly ExamWindow[];
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
  return withoutUntestableChallenges({
    built: settlePlannedBosses({ build: buildWithBosses, input: given }),
    input: given,
  });
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
        given,
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
      given,
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
      given,
      input: chosen,
      keepsRest,
      landedUnits: landedFor(choices),
      learnedOrder: reference.order,
      resolution,
    }),
  );
}

function planGoal({
  given,
  input,
  keepsRest,
  landedUnits,
  learnedOrder,
  resolution,
}: {
  /** The build's own input, before a landing holds its newly written lessons back from `input`. */
  given: BuildPlanInput;
  input: BuildPlanInput;
  keepsRest: boolean;
  landedUnits: LandedUnits | null;
  learnedOrder: LaidOutOrder | null;
  resolution: MockResolution | null;
}): BuiltPlan {
  const planStart = getPlanStart(input);

  const work = preparePlanWork({ input, keepsRest, landedUnits, planStart, resolution });
  const { funded, priorities, queue, start, unitsByKey, windows } = work;

  const {
    finished,
    frozen,
    landed: landedStandIns,
    replaced,
    setAsideBefore,
    thisWeek,
  } = work.split;

  const keptWork = [...finished, ...thisWeek, ...frozen];
  const unplaced = markKeptLessons({ input, kept: keptWork, units: work.limited });

  const phaseEnds = windows.length > 0 ? new Map() : (input.phaseEnds ?? new Map());

  const { carriedSchedule, keptParts, keptPortions, keptUntil, restSchedule, spill, yielded } =
    createLayOut({
      input,
      kept: keptWork,
      learnedOrder,
      phaseEnds,
      planStart,
      queue: priorities,
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
    landed: withoutRepeatedLandings({ kept: [...finished, ...frozen], landed: landedUnits }),
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
    schedule: { ...schedule, dropped: [...schedule.dropped, ...work.deferred] },
    start,
    windows,
  });

  const outlined = (keepsRest ? [...landed, ...laidOut] : landed).filter((unit) => unit.lessonId);
  const landedBySkill = Map.groupBy(outlined, (unit) => unit.skillId ?? "");

  const units = joinStandIns([...schedule.units, ...(afterExam?.units ?? [])]);

  const stillAside = listStillSetAside({ items: setAsideBefore, placed: units });

  const kept = [...finished, ...stillAside, ...thisWeek].flatMap((item) =>
    landedStandIns.includes(item)
      ? (landedBySkill.get(item.skillId ?? "") ?? []).map((unit) => fromUnit(unit))
      : [toKeptItem({ input, item, units: unitsByKey, windows })],
  );

  const setAside = setAsideLeftWork({ input, placed: [...kept, ...units], yielded });

  const merged = mergePlanItems({
    events: spare.events,
    kept: [...kept, ...setAside],
    replaced,
    units,
  });

  const dropped = afterExam?.dropped ?? [...schedule.dropped, ...work.deferred];

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
    queue: [...queue.filter((unit) => work.finishedKeys.has(unit.key)), ...unplaced],
    scheduleStart: start,
    windows,
    writingSchedule: work.writing.writingSchedule,
  });

  return {
    ...outline,
    skillLessons,
    ...listDroppedSkills(dropped),
    endsBeforeLessons: listEndsBeforeLessons({ given, items, laidOut, phaseEnds, skillLessons }),
    items,
    keptKeys: new Set([...kept, ...setAside].map((item) => item.key)),
    ...listLessonDays(units, keptPortions),
    mockFunding: mocks.mockFunding,
    mocks,
    order: toLaidOutOrder(restSchedule),
    planDays: funded.days,
    skillMinutes: getLandingSkillMinutes({
      dropped: [...dropped, ...listKeptStandInCuts({ frozen, units: unitsByKey })],
      kept: queue.filter((unit) => work.finishedKeys.has(unit.key)),
      landed: landedUnits,
      pending: [...unplaced, ...work.deferred],
    }),
    spill,
    strainedEnds: listStrainedEnds({ days: funded.days, ends: phaseEnds, units: laidOut }),
    ...work.writing,
    ...listBossDayFacts({ days: challengeDays, input, kept: keptPortions, units }),
  };
}
