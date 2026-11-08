import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { z } from "zod";
import { MAX_ONBOARDING_ANSWER_LENGTH } from "../../view-models/onboarding/onboarding-limits";
import {
  LANGUAGE_AIMS,
  LANGUAGE_REASONS,
  type LanguageAimView,
  type LanguageReasonView,
} from "./language-aims";

export const languageAimViewSchema = z
  .object({
    aim: z
      .enum(CEFR_LEVELS)
      .nullable()
      .meta({ description: "The level the course goes up to; null when none is set yet" }),
    choices: z
      .array(
        z.object({
          aim: z.enum(LANGUAGE_AIMS),
          hours: z
            .int()
            .meta({
              description:
                "Hours of study, practice included, from the learner's level to this aim; from scratch while the level isn't known",
            }),
        }),
      )
      .meta({
        description: "The aims above the learner's level, lowest first, to offer as a change",
      }),
  })
  .meta({
    description:
      "Language goals only, null for others: the level the course goes up to, and the aims above the learner's level to change it to with the plan change `setAim`",
    id: "LanguageAim",
  }) satisfies z.ZodType<LanguageAimView>;

export const languageReasonViewSchema = z
  .object({
    aim: z
      .enum(LANGUAGE_AIMS)
      .nullable()
      .meta({
        description: "The level this reason aims for; null for a certificate, whose exam decides",
      }),
    hours: z
      .int()
      .nullable()
      .meta({
        description: "Hours of study from scratch, practice included; null for a certificate",
      }),
    reason: z.enum(LANGUAGE_REASONS),
  })
  .meta({ id: "LanguageReason" }) satisfies z.ZodType<LanguageReasonView>;

export const reasonAnswerSchema = z
  .object({
    question: z.literal("reason"),
    reason: z
      .enum(LANGUAGE_REASONS)
      .meta({
        description:
          "Why the learner studies the language, which sets the level the course goes up to (`languageAim.reasons`): certificate moves the goal to an exam goal for the certificate `words` names",
      }),
    words: z
      .string()
      .trim()
      .min(1)
      .max(MAX_ONBOARDING_ANSWER_LENGTH)
      .nullable()
      .optional()
      .meta({
        description:
          "For certificate, which one (IELTS, DELE, CELI). For other, the learner's own words",
      }),
  })
  .strict();
