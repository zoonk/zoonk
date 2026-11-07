import "server-only";
import { prisma } from "@zoonk/db";
import { DEFAULT_REMINDER_TIME, type ReminderOffer } from "../study-reminder-contract";

/** For the result of a finished plan lesson: asks once, and never once a channel is on. */
export async function findReminderOffer({
  goalStudyTime,
  userId,
}: {
  goalStudyTime: string | null;
  userId: string;
}): Promise<ReminderOffer> {
  const reminder = await prisma.studyReminder.findUnique({
    select: { emailOn: true, offeredAt: true, pushOn: true, time: true },
    where: { userId },
  });

  if (reminder?.offeredAt || reminder?.emailOn || reminder?.pushOn) {
    return null;
  }

  return { time: reminder?.time ?? goalStudyTime ?? DEFAULT_REMINDER_TIME };
}
