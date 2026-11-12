import {
  type ProfileQuestionView,
  type ProfileQuestionsView,
  profileQuestionSchema,
} from "@zoonk/core/profile/questions/contract";
import { z } from "zod";

const profileQuestionViewSchema = z
  .object({
    id: profileQuestionSchema,
    options: z
      .array(
        z.object({
          description: z
            .string()
            .nullable()
            .meta({ description: "Optional description in the request locale" }),
          id: z.string().meta({ description: "Stable option id, accepted by the answer input" }),
          label: z.string().meta({ description: "Option label in the request locale" }),
        }),
      )
      .meta({ description: "Selectable options in order, with locale extras first" }),
    saved: z
      .object({
        picks: z
          .array(z.string())
          .meta({
            description:
              "Saved option, status, condition, need or address form ids; noSoundEffects represents disabled sounds",
          }),
        studies: z
          .array(
            z.object({
              field: z.string().meta({ description: "Study field id" }),
              subject: z
                .string()
                .nullable()
                .meta({ description: "Optional own words naming the course or subject" }),
            }),
          )
          .meta({ description: "Saved studies; empty for other questions" }),
        text: z
          .string()
          .meta({ description: "Saved favorites, job, condition note or support note" }),
      })
      .meta({
        description:
          "Prefill even when a question's version has changed; deleted memory parts stay empty",
      }),
    status: z
      .enum(["answered", "declined"])
      .nullable()
      .meta({ description: "Saved outcome; null until answered or declined" }),
    version: z.int().meta({ description: "The current version of this question" }),
  })
  .meta({ id: "ProfileQuestionView" }) satisfies z.ZodType<ProfileQuestionView>;
export const profileQuestionsResponseSchema = z
  .object({
    memoryEnabled: z
      .boolean()
      .meta({ description: "Whether biography answers may be edited and written to memory" }),
    questions: z
      .array(profileQuestionViewSchema)
      .meta({ description: "All ten optional profile questions in screen order" }),
  })
  .meta({ id: "ProfileQuestions" }) satisfies z.ZodType<ProfileQuestionsView>;
export const profileAnswerResponseSchema = z
  .object({ question: profileQuestionViewSchema })
  .meta({ id: "ProfileAnswerResponse" });
