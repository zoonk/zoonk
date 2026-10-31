import { z } from "zod";
import { languageConversationViewSchema } from "./conversation-contract";

/** A checkpoint's call as its intro shows it before the call exists. */
const languageConversationIntroSchema = languageConversationViewSchema
  .pick({
    character: true,
    exam: true,
    examTask: true,
    kind: true,
    level: true,
    minutes: true,
    objectives: true,
    situation: true,
    targetLanguage: true,
    title: true,
  })
  .meta({ id: "LanguageConversationIntro" });

export type LanguageConversationIntro = z.infer<typeof languageConversationIntroSchema>;

/**
 * Where a language goal's checkpoint stands as its screen opens, read without writing anything:
 * the call already made, its intro, the unit's call not written yet, earlier work first, Plus
 * required, or not a language call at all.
 */
export const languageCheckpointCallSchema = z
  .discriminatedUnion("status", [
    z
      .object({ conversationId: z.uuid(), status: z.literal("ready") })
      .meta({
        description:
          "The call exists, finished or not: open it (`GET /v1/language-conversations/{conversationId}`)",
        id: "LanguageCheckpointCallReady",
      }),
    z
      .object({
        dailyLimitReached: z
          .boolean()
          .meta({
            description:
              "Today's study time is used up, so Start would refuse this call until tomorrow: say so on the intro before any tap",
          }),
        intro: languageConversationIntroSchema,
        status: z.literal("notStarted"),
      })
      .meta({
        description:
          'The call isn\'t made yet: show its intro, and Start makes it (`POST /v1/language-conversations` with `kind: "checkpoint"`)',
        id: "LanguageCheckpointCallIntro",
      }),
    z
      .object({ status: z.literal("preparing"), unitTitle: z.string() })
      .meta({
        description:
          "The unit's call isn't written yet: Start writes and makes it (`POST /v1/language-conversations`)",
        id: "LanguageCheckpointCallPreparing",
      }),
    z
      .object({ reason: z.enum(["challenge", "lessons"]), status: z.literal("earlierFirst") })
      .meta({
        description:
          "Earlier lessons or an earlier phase challenge of the session come first: go back to Today",
        id: "LanguageCheckpointCallEarlierFirst",
      }),
    z
      .object({ status: z.literal("plusRequired") })
      .meta({
        description:
          "The learner's plan leaves phase challenges to Plus: show the challenge's intro (`GET /v1/challenges/{planItemId}`), locked, with what Plus unlocks",
        id: "LanguageCheckpointCallPlusRequired",
      }),
    z
      .object({ status: z.literal("notLanguage") })
      .meta({
        description:
          "Not a language goal's call (another goal's checkpoint, or a weekly challenge): the block plays as a checkpoint (`GET /v1/checkpoints/{blockId}`)",
        id: "LanguageCheckpointCallNotLanguage",
      }),
  ])
  .meta({ id: "LanguageCheckpointCall" });

export type LanguageCheckpointCall = z.infer<typeof languageCheckpointCallSchema>;
