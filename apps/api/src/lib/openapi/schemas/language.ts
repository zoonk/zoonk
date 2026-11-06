import { languageLevelTestViewSchema } from "@zoonk/core/language/level-test/contract";
import { spokenAnswerFieldsSchema } from "@zoonk/core/library/language/spoken-answer-contract";
import { noticedPatternSchema } from "@zoonk/core/view-models/language/contract";
import { LiveCallEndReason } from "@zoonk/db/live-call-enums";
import { MAX_CEFR_SCORE } from "@zoonk/utils/cefr";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

/** Only documents the multipart form: the route reads its fields with `spokenAnswerFieldsSchema`. */
export const spokenAnswerRequestSchema = spokenAnswerFieldsSchema
  .extend({
    audio: z
      .file()
      .meta({
        description:
          "The recording: WebM (Opus) or MP4 and M4A (AAC), up to 2 MB and a minute. Never kept.",
      }),
  })
  .meta({ id: "SpokenAnswerRequest" });

export const languageConversationPathParamsSchema = z
  .object({ conversationId: uuidSchema().meta({ description: "Live conversation ID" }) })
  .meta({ id: "LanguageConversationPathParams" });

export const languageConversationConnectionPathParamsSchema = languageConversationPathParamsSchema
  .extend({ connectionId: uuidSchema().meta({ description: "Reserved live-call connection ID" }) })
  .meta({ id: "LanguageConversationConnectionPathParams" });

export const liveCallEndResponseSchema = z
  .object({
    endReason: z
      .enum(LiveCallEndReason)
      .nullable()
      .meta({
        description:
          "Why the connection ended: `deadline` when the server had already hung it up at the call's deadline, which closes the call's channel without `session.closed`",
      }),
    status: z.literal("closed"),
  })
  .meta({ id: "LiveCallEndResponse" });

export const mistakePatternPathParamsSchema = z
  .object({ patternId: uuidSchema().meta({ description: "Mistake pattern ID" }) })
  .meta({ id: "MistakePatternPathParams" });

export const languageUnitPathParamsSchema = z
  .object({
    chapterId: uuidSchema().meta({ description: "Library chapter ID of a language unit" }),
  })
  .meta({ id: "LanguageUnitPathParams" });

export const languageUnitQuerySchema = z
  .object({
    goalId: uuidSchema()
      .optional()
      .meta({
        description:
          "The language goal; when left out, the goal the learner chose if it's for the unit's language, otherwise their latest one for it",
      }),
  })
  .meta({ id: "LanguageUnitQuery" });

export const levelTestSpokenAnswerRequestSchema = z
  .object({
    audio: z
      .file()
      .meta({
        description:
          "The recording: WebM (Opus) or MP4 and M4A (AAC), up to 2 MB and a minute. Never kept.",
      }),
  })
  .meta({ id: "LanguageLevelTestSpokenAnswerRequest" });

export const languageConversationCreatedSchema = z
  .object({ conversationId: uuidSchema() })
  .meta({ id: "LanguageConversationCreated" });

export const languageLevelTestSpokenResultSchema = z
  .object({
    heard: z.object({
      score: z.number().min(0).max(1),
      transcript: z.string(),
      words: z.array(
        z.object({
          heard: z.string().nullable(),
          status: z.enum(["correct", "different", "missed"]),
          text: z.string(),
        }),
      ),
    }),
    test: languageLevelTestViewSchema,
  })
  .meta({ id: "LanguageLevelTestSpokenResult" });

export const languageLevelTestResultSchema = z
  .object({
    levels: z
      .array(
        z.object({
          label: z.string(),
          score: z.number().min(0).max(MAX_CEFR_SCORE),
          skill: z.enum(["reading", "listening", "speaking", "writing"]),
        }),
      )
      .meta({
        description:
          "Each tested skill's starting level. Speaking has one only when the sentence was said out loud; writing has none, since the test asks nothing written",
      }),
  })
  .meta({ id: "LanguageLevelTestResult" });

export const languageLevelTestGenerationSchema = z
  .object({
    generationId: z
      .string()
      .nullable()
      .meta({
        description:
          "The run writing the pair's questions: stream GET /generations/{generationId}/events until `levelTestBankReady`. Null when they're already written",
      }),
    status: z
      .enum(["ready", "started"])
      .meta({
        description:
          "`ready`: the test can start now. `started`: the questions are being written (a run already writing them is joined); ask GET /goals/{goalId}/language-level-test again every few seconds",
      }),
  })
  .meta({ id: "LanguageLevelTestGeneration" });

export const goalMistakePatternSchema = z
  .object({
    pattern: noticedPatternSchema
      .nullable()
      .meta({
        description:
          "A language goal's pattern noticed in recent mistakes, not practiced or dismissed yet; open it with GET /v1/mistake-patterns/{patternId}. Null for any other goal, and when one of the day's missions already opens it",
      }),
  })
  .meta({ id: "GoalMistakePattern" });
