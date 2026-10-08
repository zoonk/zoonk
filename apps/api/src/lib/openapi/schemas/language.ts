import { languageLevelTestViewSchema } from "@zoonk/core/language/level-test/contract";
import { spokenAnswerFieldsSchema } from "@zoonk/core/library/language/spoken-answer-contract";
import { MAX_CEFR_SCORE } from "@zoonk/utils/cefr";
import { z } from "zod";

/**
 * The multipart body of a spoken answer: the recording plus its fields. The
 * route reads the fields with `spokenAnswerFieldsSchema`; this schema only
 * documents the whole form.
 */
export const spokenAnswerRequestSchema = spokenAnswerFieldsSchema
  .extend({
    audio: z
      .file()
      .meta({
        description:
          "The recording: WebM (Opus), MP4 or M4A (AAC), MP3 or WAV, up to 2 MB. Never kept.",
      }),
  })
  .meta({ id: "SpokenAnswerRequest" });

export const languageConversationPathParamsSchema = z
  .object({ conversationId: z.uuid().meta({ description: "Live conversation ID" }) })
  .meta({ id: "LanguageConversationPathParams" });

export const mistakePatternPathParamsSchema = z
  .object({ patternId: z.uuid().meta({ description: "Mistake pattern ID" }) })
  .meta({ id: "MistakePatternPathParams" });

export const languageUnitPathParamsSchema = z
  .object({ chapterId: z.uuid().meta({ description: "Library chapter ID of a language unit" }) })
  .meta({ id: "LanguageUnitPathParams" });

export const languageUnitQuerySchema = z
  .object({
    goalId: z
      .uuid()
      .optional()
      .meta({
        description: "The language goal; the learner's goal for the unit's language when left out",
      }),
  })
  .meta({ id: "LanguageUnitQuery" });

/** The multipart body of the level test's sentence out loud. */
export const levelTestSpokenAnswerRequestSchema = z
  .object({
    audio: z
      .file()
      .meta({
        description:
          "The recording: WebM (Opus), MP4 or M4A (AAC), MP3 or WAV, up to 2 MB. Never kept.",
      }),
  })
  .meta({ id: "LanguageLevelTestSpokenAnswerRequest" });

export const languageConversationCreatedSchema = z
  .object({ conversationId: z.uuid() })
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
