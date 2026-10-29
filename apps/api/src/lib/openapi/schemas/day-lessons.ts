import { z } from "zod";

export const emptyDaySchema = z
  .enum(["lessonsComing", "lessonsToPrepare", "nothingNew"])
  .nullable()
  .meta({
    description:
      "Why a day with study time has no blocks: `lessonsComing` while its lessons are still being outlined (the day fills in on its own; read it again), `lessonsToPrepare` when its lessons aren't written and nobody is outlining them (show one action that posts the goal's lesson preparation; the next read says `lessonsComing`; never post it on your own), `nothingNew` when every lesson of the plan is done or one the learner showed they know, so offer practice (`extraTime`), the week's challenge or the buddy instead (on a free exam plan past its first week, whose new lessons come with Plus: nothing to review or fix today). Null when the day has blocks or no study time",
  });

export const lessonsComingSchema = z
  .boolean()
  .meta({
    description:
      "The day has blocks and holds time for more lessons still being outlined: they join the end of its blocks on their own once they land (read it again), so say more is on the way. False otherwise, on a free exam plan past its first week (it adds no new lessons), and on a day without blocks (`emptyDay` says why)",
  });

export const lessonsToPrepareSchema = z
  .boolean()
  .meta({
    description:
      "The day has only practice, holds time for lessons, and its next lessons aren't written while nobody is outlining them: offer one action that posts the goal's lesson preparation, as for an empty day's `lessonsToPrepare`, and the next read says `lessonsComing`. Never post it on your own. False otherwise, and on a day without blocks (`emptyDay` says why)",
  });

export const examTomorrowSchema = z
  .boolean()
  .meta({
    description:
      "The goal's exam is tomorrow: nothing of the goal comes back tomorrow (its next lesson, a saved mistake, lessons to catch up), so don't point there",
  });
