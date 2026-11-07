import "server-only";
import { type StudyReminder, prisma } from "@zoonk/db";
import { findActiveGoalId } from "../../goals/_utils/goal-view";
import { getLearnerTimeZone } from "../../learner/_utils/goal-time-zone";
import { DEFAULT_REMINDER_TIME, type StudyReminderView } from "../study-reminder-contract";
import { roundToQuarterHour } from "./quarter-hour";
import { isReminderQuiet } from "./reminder-quiet";

type ReminderUser = { email: string; id: string; isAnonymous?: boolean | null };

export async function findDefaultReminderTime(userId: string): Promise<string> {
  const goalId = await findActiveGoalId(userId);

  const goal = goalId
    ? await prisma.goal.findUnique({ select: { studyTime: true }, where: { id: goalId } })
    : null;

  return roundToQuarterHour(goal?.studyTime ?? DEFAULT_REMINDER_TIME);
}

export async function findLastStudyDate(userId: string): Promise<Date | null> {
  const day = await prisma.dailyProgress.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
    where: { timeSpentSeconds: { gt: 0 }, userId },
  });

  return day?.date ?? null;
}

function getPhone(reminder: StudyReminder | null): StudyReminderView["push"]["phone"] {
  if (!reminder?.pushToken || !reminder.pushPlatform || !reminder.pushLabel) {
    return null;
  }

  return { label: reminder.pushLabel, platform: reminder.pushPlatform, token: reminder.pushToken };
}

export async function findStudyReminderView({
  now,
  user,
}: {
  now: Date;
  user: ReminderUser;
}): Promise<StudyReminderView> {
  const [reminder, timeZone, defaultTime, lastStudyDate] = await Promise.all([
    prisma.studyReminder.findUnique({ where: { userId: user.id } }),
    getLearnerTimeZone({ userId: user.id }),
    findDefaultReminderTime(user.id),
    findLastStudyDate(user.id),
  ]);

  const emailOn = reminder?.emailOn ?? false;
  const pushOn = reminder?.pushOn ?? false;

  return {
    email: { address: user.isAnonymous ? null : user.email, on: emailOn },
    push: { on: pushOn, phone: getPhone(reminder) },
    quiet:
      (emailOn || pushOn) &&
      isReminderQuiet({ enabledAt: reminder?.enabledAt ?? null, lastStudyDate, now, timeZone }),
    time: reminder?.time ?? defaultTime,
    timeZone,
  };
}
