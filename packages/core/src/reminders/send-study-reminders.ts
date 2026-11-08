import "server-only";
import { prisma } from "@zoonk/db";
import { type PushPlatform } from "@zoonk/db/enums";
import { getLearnerTimeZone } from "../learner/_utils/goal-time-zone";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { findGoalsWithWork, hasStudiedRecently } from "./_utils/reminder-goals";
import { getReminderPhone } from "./_utils/reminder-phone";
import { isReminderQuiet } from "./_utils/reminder-quiet";
import { getReminderWindow } from "./_utils/reminder-window";
import { findLastStudyDate } from "./_utils/study-reminder-view";
import { signStudyReminderUnsubscribeToken } from "./email-unsubscribe";
import { type ReminderMessage, pickReminderMessage } from "./reminder-message";

type ReminderChannel = "email" | "push";

type Destination =
  | { address: string; channel: "email"; unsubscribeToken: string }
  | { channel: "push"; platform: PushPlatform; token: string };

/** What the claim decided, carried by each delivery so a late retry can't send on another day. */
export type ReminderClaim = { endsAt: Date; localDate: Date };

type ClaimOutcome =
  | ({ status: "claimed" } & ReminderClaim)
  | { status: "deferred" | "notDue" | "skipped" };

export type StudyReminderDelivery = Destination & {
  expiresAt: Date;
  locale: string;
  message: ReminderMessage;
};

/**
 * A prefilter: rows whose local time, in the active goal's zone, is inside today's send window and
 * that weren't considered today. A zone Postgres doesn't know reads as UTC, so one bad zone can't
 * fail the scan; the claim checks the window again with the zone rules Today uses.
 */
export async function listDueStudyReminders(now: Date): Promise<string[]> {
  // Prisma binds a Date without its offset, so Postgres would read it in the session's zone.
  const rows = await prisma.$queryRaw<{ userId: string }[]>`
    SELECT reminder.user_id AS "userId"
    FROM study_reminders AS reminder
    LEFT JOIN user_learning_profiles AS profile ON profile.user_id = reminder.user_id
    LEFT JOIN LATERAL (
      SELECT goal.timezone FROM goals AS goal
      WHERE goal.user_id = reminder.user_id
        AND (goal.id = profile.active_goal_id
          OR (profile.active_goal_id IS NULL AND goal.status = 'active'))
      ORDER BY goal.created_at
      LIMIT 1
    ) AS active_goal ON TRUE
    LEFT JOIN pg_timezone_names AS zone ON zone.name = active_goal.timezone
    CROSS JOIN LATERAL (
      SELECT ${now.toISOString()}::timestamptz AT TIME ZONE COALESCE(zone.name, 'UTC') AS local_now
    ) AS clock
    WHERE (reminder.email_on OR (reminder.push_on
      AND reminder.push_token IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM sessions AS push_session
        WHERE push_session.id = reminder.push_session_id
          AND push_session.expires_at > ${now}
      )))
      AND (reminder.processed_on IS NULL OR reminder.processed_on < clock.local_now::date)
      AND clock.local_now >= clock.local_now::date + reminder.time::time
      AND clock.local_now < clock.local_now::date + reminder.time::time + interval '60 minutes'
  `;

  return rows.map((row) => row.userId);
}

async function decideClaim({
  enabledAt,
  now,
  timeZone,
  userId,
}: {
  enabledAt: Date | null;
  now: Date;
  timeZone: string;
  userId: string;
}): Promise<"claimed" | "deferred" | "skipped"> {
  const lastStudyDate = await findLastStudyDate(userId);

  if (isReminderQuiet({ enabledAt, lastStudyDate, now, timeZone })) {
    return "skipped";
  }

  if (await hasStudiedRecently({ now, userId })) {
    return "deferred";
  }

  const goals = await findGoalsWithWork({ now, userId });
  return goals.length > 0 ? "claimed" : "skipped";
}

/**
 * Considers the learner's day once: only the claim that marks today processed sends. A skip marks
 * it too; a deferral leaves the row due for the next sweep inside the window.
 */
export async function claimStudyReminder({
  now,
  userId,
}: {
  now: Date;
  userId: string;
}): Promise<ClaimOutcome> {
  return writeLearnerChange<ClaimOutcome>({ userId }, async (tx) => {
    const reminder = await tx.studyReminder.findUnique({
      include: { pushSession: { select: { expiresAt: true } } },
      where: { userId },
    });

    if (
      !reminder ||
      !(reminder.emailOn || (reminder.pushOn && getReminderPhone({ now, reminder })))
    ) {
      return unchanged({ status: "notDue" as const });
    }

    const timeZone = await getLearnerTimeZone({ userId });
    const window = getReminderWindow({ now, time: reminder.time, timeZone });

    if (!window.open || (reminder.processedOn && reminder.processedOn >= window.localDate)) {
      return unchanged({ status: "notDue" as const });
    }

    const outcome = await decideClaim({ enabledAt: reminder.enabledAt, now, timeZone, userId });

    if (outcome === "deferred") {
      return unchanged({ status: outcome });
    }

    await tx.studyReminder.update({ data: { processedOn: window.localDate }, where: { userId } });

    return outcome === "claimed"
      ? { endsAt: window.endsAt, localDate: window.localDate, status: outcome }
      : { status: outcome };
  });
}

async function findDestination({
  channel,
  now,
  userId,
}: {
  channel: ReminderChannel;
  now: Date;
  userId: string;
}): Promise<{ destination: Destination; locale: string } | null> {
  const reminder = await prisma.studyReminder.findUnique({
    include: {
      pushSession: { select: { expiresAt: true } },
      user: { select: { email: true, isAnonymous: true } },
    },
    where: { userId },
  });

  if (!reminder) {
    return null;
  }

  const { locale } = reminder;

  if (channel === "email") {
    return reminder.emailOn && !reminder.user.isAnonymous
      ? {
          destination: {
            address: reminder.user.email,
            channel,
            unsubscribeToken: signStudyReminderUnsubscribeToken(userId),
          },
          locale,
        }
      : null;
  }

  const phone = getReminderPhone({ now, reminder });

  return reminder.pushOn && phone
    ? { destination: { channel, platform: phone.platform, token: phone.token }, locale }
    : null;
}

/**
 * Each channel checks again before sending: still on, same destination, work left. Past the
 * claimed window's end, which is never later than that day's midnight, it sends nothing.
 */
export async function readStudyReminderDelivery({
  channel,
  claim,
  now,
  userId,
}: {
  channel: ReminderChannel;
  claim: ReminderClaim;
  now: Date;
  userId: string;
}): Promise<StudyReminderDelivery | null> {
  if (now >= claim.endsAt) {
    return null;
  }

  const [found, goals] = await Promise.all([
    findDestination({ channel, now, userId }),
    findGoalsWithWork({ now, userId }),
  ]);

  const [first, ...rest] = goals;

  if (!found || !first) {
    return null;
  }

  return {
    ...found.destination,
    expiresAt: claim.endsAt,
    locale: found.locale,
    message: pickReminderMessage({ goals: [first, ...rest], localDate: claim.localDate }),
  };
}
