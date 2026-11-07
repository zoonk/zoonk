import { PushPlatform } from "@zoonk/db/enums";
import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { z } from "zod";
import { studyTimeSchema } from "../goals/study-time";

export const DEFAULT_REMINDER_TIME = "19:00";

const MAX_PUSH_TOKEN_LENGTH = 4096;
const MAX_PHONE_LABEL_LENGTH = 100;

const reminderTimeSchema = studyTimeSchema.meta({
  description:
    'Local time the reminder goes out, such as "19:00", in the learner\'s zone. Always on a quarter hour (:00, :15, :30 or :45), since reminders go out every 15 minutes',
});

const reminderLocaleSchema = z
  .enum(SUPPORTED_LOCALES)
  .meta({ description: "The app language reminders are written in: send the app's current one" });

const reminderTimeZoneSchema = z
  .string()
  .meta({
    description:
      "The IANA zone reminders follow: the active goal's. Show it next to the time, named the platform's localized way",
  });

const pushPlatformSchema = z.enum(PushPlatform).meta({ id: "PushPlatform" });

const studyReminderSchema = z
  .object({
    email: z.object({
      address: z
        .string()
        .nullable()
        .meta({
          description:
            "Where email reminders go; null for a guest, who needs an account to turn them on",
        }),
      on: z.boolean(),
    }),
    push: z.object({
      on: z.boolean(),
      phone: z
        .object({
          label: z.string().meta({ description: "The phone's name, such as \"Ana's iPhone\"" }),
          platform: pushPlatformSchema,
          token: z
            .string()
            .meta({
              description: "Compare with this installation's token to tell if it's this one",
            }),
        })
        .nullable()
        .meta({ description: "The one phone push goes to, or null when none is selected" }),
    }),
    quiet: z
      .boolean()
      .meta({
        description:
          "A channel is on, but reminders are paused: 7 days passed without study since the last study day or the last time a channel was turned on. Studying turns them back on",
      }),
    time: reminderTimeSchema,
    timeZone: reminderTimeZoneSchema,
  })
  .meta({
    description:
      "Every reminder setting, with defaults before the learner saves any: off, at the active goal's study time or 19:00",
    id: "StudyReminder",
  });

export type StudyReminderView = z.infer<typeof studyReminderSchema>;

export const studyReminderResponseSchema = z
  .object({ reminder: studyReminderSchema })
  .meta({ id: "StudyReminderResponse" });

/** Omitted fields keep their saved value; a stale screen can't turn a channel back on. */
export const studyReminderUpdateSchema = z
  .object({
    emailOn: z
      .boolean()
      .optional()
      .meta({ description: "Turning it on needs an account: guests get 422 ACCOUNT_REQUIRED" }),
    locale: reminderLocaleSchema,
    pushOn: z
      .boolean()
      .optional()
      .meta({
        description:
          "Turning it on needs a selected phone (PUT /me/study-reminder/phone first): 422 PHONE_REQUIRED otherwise",
      }),
    time: reminderTimeSchema
      .optional()
      .meta({
        description:
          'Local time, such as "19:15". Minutes other than 00, 15, 30 or 45 get 422 TIME_NOT_ON_QUARTER_HOUR: round the picked time to the nearest quarter hour before showing and saving it',
      }),
  })
  .strict()
  .meta({ id: "StudyReminderUpdate" });

export type StudyReminderUpdateInput = z.infer<typeof studyReminderUpdateSchema>;

export const studyReminderOfferClaimSchema = z
  .object({ locale: reminderLocaleSchema })
  .strict()
  .meta({ id: "StudyReminderOfferClaim" });

export type StudyReminderOfferClaimInput = z.infer<typeof studyReminderOfferClaimSchema>;

export const studyReminderOfferResultSchema = z
  .object({
    claimed: z
      .boolean()
      .meta({
        description:
          "True only for the call that marked the offer shown. False when it was already shown, here or on another device: don't show it",
      }),
  })
  .meta({ id: "StudyReminderOfferResult" });

export const studyReminderPhoneSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1)
      .max(MAX_PHONE_LABEL_LENGTH)
      .meta({ description: "The phone's name, shown in Settings on every device" }),
    locale: reminderLocaleSchema,
    platform: pushPlatformSchema,
    token: z
      .string()
      .min(1)
      .max(MAX_PUSH_TOKEN_LENGTH)
      .meta({
        description: "The APNs device token (hex) on iOS, the FCM registration token on Android",
      }),
  })
  .strict()
  .meta({ id: "StudyReminderPhone" });

export type StudyReminderPhoneInput = z.infer<typeof studyReminderPhoneSchema>;

export const reminderOfferSchema = z
  .object({ time: reminderTimeSchema, timeZone: reminderTimeZoneSchema })
  .nullable()
  .meta({
    description:
      "After a plan lesson, while no reminder channel is on and the offer was never shown: offer study reminders at `time` (the saved time, the goal's study time or 19:00). Claim it with POST /me/study-reminder/offer when it's shown. Null otherwise",
    id: "StudyReminderOffer",
  });

export type ReminderOffer = z.infer<typeof reminderOfferSchema>;
