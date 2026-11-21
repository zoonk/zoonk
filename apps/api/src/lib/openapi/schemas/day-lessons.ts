import { DAY_STATES } from "@zoonk/core/sessions/day-state";
import { z } from "zod";

export const emptyDaySchema = z
  .enum(["lessonsComing", "lessonsToPrepare", "nothingNew"])
  .nullable()
  .meta({
    description:
      "Why a day with study time has no blocks: `lessonsComing` while its lessons are still being outlined (the day fills in on its own; read it again), `lessonsToPrepare` when its lessons aren't written and no preparation is in progress, `nothingNew` when every lesson of the plan is done or one the learner showed they know. Null when the day has blocks or no study time",
  });

export const lessonsComingSchema = z
  .boolean()
  .meta({
    description:
      "The day has blocks and holds time for more lessons still being outlined: they join the end of its blocks on their own once they land (read it again). False otherwise, and on a day without blocks (`emptyDay` says why)",
  });

export const lessonsToPrepareSchema = z
  .boolean()
  .meta({
    description:
      "The day has blocks and holds time for more lessons that aren't written while no preparation is in progress. False otherwise, and on a day without blocks (`emptyDay` says why)",
  });

export const lessonPlaceholderSchema = z
  .object({ minutes: z.number().positive(), title: z.string() })
  .nullish()
  .meta({
    description:
      "The first topic in plan order whose outline still owes lessons the day reserves time for. The title is the plan item's title and minutes is its allocation on this day. Null when the day holds no time for an unwritten topic.",
  });

export const examTomorrowSchema = z
  .boolean()
  .meta({
    description:
      "The goal's exam is tomorrow: nothing of the goal comes back tomorrow (its next lesson, a saved mistake, lessons to catch up)",
  });

export const dayStateSchema = z
  .enum(DAY_STATES)
  .default("underway")
  .meta({
    description:
      "Where the day stands: `underway` (a block to start or continue), `done` (every block behind the learner), `waiting` (lessons it holds time for are still being outlined; read it again), `prepare` (lessons it holds time for wait for the learner to ask for them, see `emptyDay` and `lessonsToPrepare`), `ahead` (nothing new to learn) or `rest` (no study planned). Always sent",
  });
