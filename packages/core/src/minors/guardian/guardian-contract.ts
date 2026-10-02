import { type GuardianLinkStatus } from "@zoonk/db";
import { z } from "zod";

const MIN_DAILY_LIMIT_MINUTES = 10;
const MAX_DAILY_LIMIT_MINUTES = 480;
const EMAIL_MAX_LENGTH = 254;
const TOKEN_MAX_LENGTH = 200;

export const guardianInviteSchema = z
  .object({ email: z.email().max(EMAIL_MAX_LENGTH).meta({ description: "The guardian's email" }) })
  .strict()
  .meta({ id: "GuardianInvite" });

export type GuardianInviteInput = z.infer<typeof guardianInviteSchema>;

export const guardianInviteAcceptanceSchema = z
  .object({
    token: z
      .string()
      .min(1)
      .max(TOKEN_MAX_LENGTH)
      .meta({ description: "The token from the invite link" }),
  })
  .strict()
  .meta({ id: "GuardianInviteAcceptance" });

/**
 * The daily limits screens offer, in minutes, from a short session to a long study day. The API
 * accepts any value from 10 to 480.
 */
const DAILY_LIMIT_CHOICE_MINUTES = {
  halfHour: 30,
  hour: 60,
  hourAndHalf: 90,
  quarterHour: 15,
  threeHours: 180,
  threeQuarters: 45,
  twoHours: 120,
};

export const DAILY_LIMIT_CHOICES = Object.values(DAILY_LIMIT_CHOICE_MINUTES).toSorted(
  (first, second) => first - second,
);

/** A daily study limit, set by a guardian or by the learner. */
export const dailyLimitMinutesSchema = z
  .int()
  .min(MIN_DAILY_LIMIT_MINUTES)
  .max(MAX_DAILY_LIMIT_MINUTES)
  .nullable()
  .meta({ description: "Daily study limit in minutes, or null for no limit" });

export const guardedLearnerUpdateSchema = z
  .object({ dailyLimitMinutes: dailyLimitMinutesSchema })
  .strict()
  .meta({ id: "GuardedLearnerUpdate" });

/** A guardian link as the learner sees it. The token never leaves the invite email. */
export type GuardianLinkView = {
  acceptedAt: Date | null;
  createdAt: Date;
  dailyLimitMinutes: number | null;
  expiresAt: Date | null;
  guardianEmail: string;
  id: string;
  plusApprovedAt: Date | null;
  status: GuardianLinkStatus;
};

export type WeeklyActivityDay = { date: Date; lessonsCompleted: number; minutes: number };

/** A learner as their guardian sees them: the last seven days and the controls the guardian set. */
export type GuardedLearnerView = {
  dailyLimitMinutes: number | null;
  learnerName: string;
  linkId: string;
  plusApprovedAt: Date | null;
  weeklyActivity: { days: WeeklyActivityDay[]; lessonsCompleted: number; minutes: number };
};
