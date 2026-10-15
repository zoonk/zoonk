import {
  type CatchUpView,
  type StudyBlockView,
  type StudySessionView,
} from "./_utils/session-view";
import { type DayBlockRef } from "./day-block";
import { type Mission } from "./missions";

export type DayBlockView = Omit<StudyBlockView, "id">;

/** An unopened mission identifies actual work, never a database block that does not exist yet. */
export type DayMission = Omit<Mission, "opens"> & {
  opens?: Exclude<Mission["opens"], { kind: "block" }> | { kind: "block"; ref: DayBlockRef };
};

export type UnstartedDayView = Omit<
  StudySessionView,
  "blocks" | "catchUp" | "id" | "missions" | "nextBlockId" | "status"
> & {
  blocks: DayBlockView[];
  catchUp: Omit<CatchUpView, "blockIds"> | null;
  missions: DayMission[];
  status: "unstarted";
};

export type DayView = StudySessionView | UnstartedDayView;
