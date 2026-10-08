import { z } from "zod";

/** How a day's lessons stand while some are still being outlined: none yet, or more on the way. */
export const emptyDaySchema = z
  .enum(["lessonsComing", "nothingNew"])
  .nullable()
  .meta({
    description:
      "Why a day with study time has no blocks: `lessonsComing` while its lessons are still being outlined (the day fills in on its own; read it again), `nothingNew` when every lesson of the plan is done or one the learner showed they know, so offer practice (`extraTime`), the week's challenge or the buddy instead. Null when the day has blocks or no study time",
  });

export const lessonsComingSchema = z
  .boolean()
  .meta({
    description:
      "The day has blocks and holds time for more lessons still being outlined: they join the end of its blocks on their own once they land (read it again), so say more is on the way. False otherwise, and on a day without blocks (`emptyDay` says why)",
  });
