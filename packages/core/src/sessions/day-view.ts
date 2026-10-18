import {
  type CatchUpView,
  type StudyBlockView,
  type StudySessionView,
} from "./_utils/session-view";
import { type DayMission } from "./missions";

export type DayBlockView = Omit<StudyBlockView, "id">;

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
