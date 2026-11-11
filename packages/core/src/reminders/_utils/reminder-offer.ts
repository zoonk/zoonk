import "server-only";
import { prisma } from "@zoonk/db";
import { getLearnerTimeZone } from "../../learner/_utils/goal-time-zone";
import { DEFAULT_REMINDER_TIME, type ReminderOffer } from "../study-reminder-contract";
import { roundToQuarterHour } from "./quarter-hour";
import { getReminderPhone } from "./reminder-phone";

/** For the result of a finished plan lesson: asks once, and never once a channel is on. */
export async function findReminderOffer({
  goalStudyTime,
  userId,
}: {
  goalStudyTime: string | null;
  userId: string;
}): Promise<ReminderOffer> {
  const [reminder, timeZone] = await Promise.all([
    prisma.studyReminder.findUnique({
      include: { pushSession: { select: { expiresAt: true } } },
      where: { userId },
    }),
    getLearnerTimeZone({ userId }),
  ]);

  if (
    reminder?.offeredAt ||
    reminder?.emailOn ||
    (reminder?.pushOn && getReminderPhone({ now: new Date(), reminder }))
  ) {
    return null;
  }

  return {
    time: reminder?.time ?? roundToQuarterHour(goalStudyTime ?? DEFAULT_REMINDER_TIME),
    timeZone,
  };
}
