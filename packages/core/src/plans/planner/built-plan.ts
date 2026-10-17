import { type StrainedEnd } from "./kept-phase-ends";
import { type LaidOutOrder } from "./learned-order";
import { type MockFunding } from "./mock-funding";
import { type PlannedItem } from "./plan-items";
import { type PlannedMocks } from "./planned-mocks";
import { type PlanDay } from "./schedule-units";
import { type SkillMinutes } from "./skill-minutes";
import { type PlanOutline } from "./summarize-plan";

/** What a planning run builds (see `buildPlan`). */
export type BuiltPlan = PlanOutline & {
  /** The days an exam's phase challenge can go (see `listPhaseChallengeDays`). */
  studyDays: string[];
  /** The day each scheduled lesson's time ends, by its key, when later than its date. */
  teachingEnds: ReadonlyMap<string, Date>;
  /** The day minutes each scheduled lesson takes on each of its days, by its key and day. */
  lessonDayMinutes: ReadonlyMap<string, ReadonlyMap<string, number>>;
  /** The lesson minutes those are (`lessonDayMinutes`), which a day's share turns into its time. */
  lessonRawMinutes: ReadonlyMap<string, ReadonlyMap<string, number>>;
  /** Skills the plan can't cover whole before its deadline at this pace. */
  droppedSkillIds: string[];
  /**
   * The kept phase ends whose challenge comes before a lesson it tests (see
   * `listEndsBeforeLessons`), by phase: a missed day's settling lets them go.
   */
  endsBeforeLessons: number[];
  items: PlannedItem[];
  /** The items the run kept as they were (finished work, this week's), which go first on their day. */
  keptKeys: ReadonlySet<string>;
  /** The mocks the plan funds, which Today reads days' time through (see `fundMocks`). */
  mockFunding: MockFunding[];
  /** The actual selected allocation, projected without another plan build. */
  planDays: PlanDay[];
  /** How the run settled its mocks (see `settlePlannedMocks`), its unfunded ones included. */
  mocks: PlannedMocks;
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
