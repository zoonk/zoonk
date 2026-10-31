import { type StrainedEnd } from "./kept-phase-ends";
import { type LaidOutOrder } from "./learned-order";
import { type MockFunding } from "./mock-funding";
import { type PlannedItem } from "./plan-items";
import { type PlannedMocks } from "./planned-mocks";
import { type PlanDay } from "./schedule-units";
import { type SkillMinutes } from "./skill-minutes";
import { type PlanOutline } from "./summarize-plan";

export type BuiltPlan = PlanOutline & {
  studyDays: string[];
  teachingEnds: ReadonlyMap<string, Date>;
  lessonDayMinutes: ReadonlyMap<string, ReadonlyMap<string, number>>;
  lessonRawMinutes: ReadonlyMap<string, ReadonlyMap<string, number>>;
  droppedSkillIds: string[];
  endsBeforeLessons: number[];
  items: PlannedItem[];
  keptKeys: ReadonlySet<string>;
  mockFunding: MockFunding[];
  planDays: PlanDay[];
  mocks: PlannedMocks;
  strainedEnds: StrainedEnd[];
  order: LaidOutOrder;
  skillMinutes: SkillMinutes[];
  spill: number;
  waitingSkillIds: string[];
};
