import { GuardianLinkStatus } from "@zoonk/db";
import { z } from "zod";

export const guardianLinkPathParamsSchema = z
  .object({ linkId: z.uuid().meta({ description: "Guardian link ID" }) })
  .meta({ id: "GuardianLinkPathParams" });

const guardianLinkSchema = z
  .object({
    acceptedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    dailyLimitMinutes: z.int().nullable().meta({ description: "Daily study limit in minutes" }),
    expiresAt: z.iso.datetime().nullable().meta({ description: "When a pending invite expires" }),
    guardianEmail: z.email(),
    id: z.uuid(),
    plusApprovedAt: z.iso.datetime().nullable().meta({ description: "When Plus was approved" }),
    status: z.enum(GuardianLinkStatus),
  })
  .meta({ id: "GuardianLink" });

export const guardianLinkResponseSchema = z
  .object({ link: guardianLinkSchema })
  .meta({ id: "GuardianLinkResponse" });

export const guardianLinkListResponseSchema = z
  .object({ links: z.array(guardianLinkSchema) })
  .meta({ id: "GuardianLinkListResponse" });

const weeklyActivityDaySchema = z
  .object({
    date: z.iso.date().meta({ description: "The learner's local day" }),
    lessonsCompleted: z.int(),
    minutes: z.int(),
  })
  .meta({ id: "WeeklyActivityDay" });

const guardedLearnerSchema = z
  .object({
    dailyLimitMinutes: z.int().nullable(),
    learnerName: z.string(),
    linkId: z.uuid(),
    plusApprovedAt: z.iso.datetime().nullable(),
    weeklyActivity: z
      .object({
        days: z.array(weeklyActivityDaySchema),
        lessonsCompleted: z.int(),
        minutes: z.int(),
      })
      .meta({ description: "The last seven days: minutes and finished lessons only" }),
  })
  .meta({ id: "GuardedLearner" });

export const guardedLearnerListResponseSchema = z
  .object({ learners: z.array(guardedLearnerSchema) })
  .meta({ id: "GuardedLearnerListResponse" });

export const guardianInviteAcceptanceResponseSchema = z
  .object({ learnerName: z.string(), linkId: z.uuid() })
  .meta({ id: "GuardianInviteAcceptanceResponse" });

export const dailyTimeLimitResponseSchema = z
  .object({
    limitMinutes: z
      .int()
      .nullable()
      .meta({
        description: "The strictest of the learner's own limit and any guardian's, or null",
      }),
    reached: z.boolean(),
    remainingMinutes: z.int().nullable(),
    usedMinutes: z.int().meta({ description: "Minutes studied on the learner's local day" }),
  })
  .meta({ id: "DailyTimeLimitResponse" });
