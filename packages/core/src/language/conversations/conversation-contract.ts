import {
  SPEAKING_MOCK_CRITERIA,
  SPEAKING_MOCK_EXAMS,
  SPEAKING_MOCK_SCALES,
} from "@zoonk/ai/tasks/v2/language/speaking-mock-bands";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { z } from "zod";
import { answerTimeZoneSchema } from "../../learner/contract";

const MAX_CONVERSATION_MINUTES = 5;

/** Practice calls last from 1 to 5 minutes, as the unit page offers them. */
export const PRACTICE_CONVERSATION_MINUTES = [1, 2, 3, MAX_CONVERSATION_MINUTES] as const;
/** The most turns a saved call keeps, and the longest turn: a five-minute call stays well under both. */
export const MAX_CONVERSATION_TURNS = 120;
export const MAX_CONVERSATION_TURN_LENGTH = 2000;
const MAX_SPOKEN_SECONDS = 900;

const speakerSchema = z.enum(["learner", "character"]);

/** The exams whose speaking test a live call runs as a mock: IELTS and TOEFL iBT, in English. */
export const speakingMockExamSchema = z.enum(SPEAKING_MOCK_EXAMS).meta({ id: "SpeakingMockExam" });

export type SpeakingMockExam = z.infer<typeof speakingMockExamSchema>;

const conversationTurnSchema = z
  .object({
    speaker: speakerSchema,
    text: z.string().trim().min(1).max(MAX_CONVERSATION_TURN_LENGTH),
  })
  .meta({ id: "LanguageConversationTurn" });

export type ConversationTurn = z.infer<typeof conversationTurnSchema>;

/** The role-play a call follows, as a model wrote it for a unit and level. */
export const conversationScenarioSchema = z.object({
  character: z.object({ name: z.string(), place: z.string(), role: z.string() }),
  characterBrief: z.string(),
  hints: z.array(z.string()),
  objectives: z.array(z.object({ description: z.string(), label: z.string() })),
  openingLine: z.string(),
  situation: z.string(),
  title: z.string(),
});

export type ConversationScenario = z.infer<typeof conversationScenarioSchema>;

/**
 * A speaking mock's scenario also names the exam it follows, which sets the examiner's script and
 * the criteria its feedback uses.
 */
export const speakingMockScenarioSchema = conversationScenarioSchema.extend({
  exam: speakingMockExamSchema,
});

const callFeedbackSchema = z
  .object({
    encouragement: z.string(),
    improve: z
      .object({ better: z.string(), said: z.string(), why: z.string() })
      .nullable()
      .meta({ description: "The one thing to fix, with what the learner said and a better way" }),
    kind: z.literal("call"),
    pronunciation: z
      .array(z.object({ respelling: z.string(), tip: z.string(), word: z.string() }))
      .meta({ description: "At most two words the learner said that are often hard to say" }),
    wentWell: z.array(z.string()).meta({ description: "Phrases the learner said well" }),
  })
  .meta({ id: "LanguageCallFeedback" });

/** A speaking mock's feedback, by its exam's own criteria and on its band scale. */
function speakingMockFeedbackFor<const TExam extends SpeakingMockExam>(exam: TExam) {
  const { max, min, step } = SPEAKING_MOCK_SCALES[exam];
  const band = z.number().min(min).max(max).multipleOf(step);
  const criterion = z.enum(SPEAKING_MOCK_CRITERIA[exam]);

  return z.object({
    criteria: z.array(
      z.object({ bandHigh: band, bandLow: band, criterion, evidence: z.string(), tip: z.string() }),
    ),
    exam: z.literal(exam),
    focus: criterion,
    kind: z.literal("speakingMock"),
    overall: z
      .object({ bandHigh: band, bandLow: band })
      .meta({ description: "Estimated band range, never an official score" }),
  });
}

const speakingMockFeedbackSchema = z
  .discriminatedUnion("exam", [
    speakingMockFeedbackFor("ielts").meta({
      description: "IELTS Speaking: four criteria on the 0 to 9 band scale",
      id: "LanguageIeltsSpeakingMockFeedback",
    }),
    speakingMockFeedbackFor("toefl").meta({
      description:
        "TOEFL iBT Speaking: Listen and Repeat accuracy and four interview criteria on the 1 to 6 band scale",
      id: "LanguageToeflSpeakingMockFeedback",
    }),
  ])
  .meta({ id: "LanguageSpeakingMockFeedback" });

export const conversationFeedbackSchema = z.discriminatedUnion("kind", [
  callFeedbackSchema,
  speakingMockFeedbackSchema,
]);

export type ConversationFeedback = z.infer<typeof conversationFeedbackSchema>;
export type CallFeedback = z.infer<typeof callFeedbackSchema>;
export type SpeakingMockFeedback = z.infer<typeof speakingMockFeedbackSchema>;
export type SpeakingCriterion = SpeakingMockFeedback["criteria"][number]["criterion"];

export const languageConversationStartInputSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        chapterId: z.uuid().meta({ description: "The unit to practice" }),
        goalId: z
          .uuid()
          .optional()
          .meta({ description: "The language goal; the active one when left out" }),
        kind: z.literal("practice"),
        minutes: z
          .union(PRACTICE_CONVERSATION_MINUTES.map((minutes) => z.literal(minutes)))
          .meta({ description: "How long the call lasts" }),
      })
      .strict(),
    z
      .object({
        blockId: z.uuid().meta({ description: "Today's checkpoint block of a language goal" }),
        kind: z.literal("checkpoint"),
      })
      .strict(),
    z
      .object({
        goalId: z
          .uuid()
          .meta({
            description:
              "An English goal preparing for IELTS or TOEFL iBT (a language goal, or the exam goal it moved to); the mock follows that exam",
          }),
        kind: z.literal("speakingMock"),
      })
      .strict(),
  ])
  .meta({ id: "LanguageConversationStartInput" });

export type LanguageConversationStartInput = z.infer<typeof languageConversationStartInputSchema>;

const conversationTurnsSchema = z
  .array(conversationTurnSchema)
  .max(MAX_CONVERSATION_TURNS)
  .meta({ description: "What was said so far, in order, as the voice model transcribed it" });

export const languageConversationCompletionInputSchema = z
  .object({
    spokenSeconds: z.int().min(0).max(MAX_SPOKEN_SECONDS),
    timeZone: answerTimeZoneSchema,
    turns: conversationTurnsSchema,
    usedHelp: z.boolean().meta({ description: "The learner used Help" }),
    voiceSeconds: z
      .int()
      .min(0)
      .max(MAX_SPOKEN_SECONDS)
      .optional()
      .meta({
        description:
          "The voice session's length that GPT-Live reported in `session.closed` (usage.seconds), for cost tracking; leave it out when the call closed without it",
      }),
  })
  .strict()
  .meta({ id: "LanguageConversationCompletionInput" });

export type LanguageConversationCompletionInput = z.infer<
  typeof languageConversationCompletionInputSchema
>;

const objectiveViewSchema = z.object({
  description: z.string(),
  label: z.string(),
  met: z.boolean(),
});

export const languageConversationViewSchema = z
  .object({
    character: z.object({ name: z.string(), place: z.string(), role: z.string() }),
    exam: speakingMockExamSchema
      .nullable()
      .meta({ description: "The exam a speaking mock follows; null for other calls" }),
    goalId: z.uuid().nullable(),
    hints: z.array(z.string()),
    id: z.uuid(),
    /** What the voice model is told; the app sends it when the call connects. */
    instructions: z.string().nullable(),
    kind: z.enum(["practice", "checkpoint", "speakingMock"]),
    level: z.enum(CEFR_LEVELS),
    minutes: z.int().min(1).max(MAX_CONVERSATION_MINUTES),
    objectives: z.array(objectiveViewSchema),
    openingLine: z.string(),
    result: z
      .object({
        brainPower: z.int(),
        feedback: conversationFeedbackSchema.nullable(),
        passed: z.boolean(),
        spokenSeconds: z.int(),
        stars: z.int().min(0).max(3),
      })
      .nullable()
      .meta({ description: "Null until the call ends" }),
    situation: z.string(),
    status: z.enum(["ready", "completed"]),
    targetLanguage: z.string(),
    title: z.string(),
    unit: z.object({ chapterId: z.uuid(), title: z.string() }).nullable(),
  })
  .meta({ id: "LanguageConversation" });

export type LanguageConversationView = z.infer<typeof languageConversationViewSchema>;

/**
 * What the app needs to open the call: GPT-Live's native Live WebSocket on AI Gateway, opened
 * with these subprotocols, whose first event is `session.start` with this model, the
 * conversation's instructions, PCM16 audio at 24 kHz and client delegation.
 */
export const languageConversationSetupSchema = z
  .object({
    expiresAt: z
      .number()
      .int()
      .nullable()
      .meta({ description: "When the token stops working, in Unix seconds; connect before then" }),
    model: z.string().meta({ description: "The model to name in `session.start`" }),
    protocols: z
      .array(z.string())
      .meta({
        description: "WebSocket subprotocols to open the connection with; they carry the token",
      }),
    token: z.string().meta({ description: "Single-use and short-lived; never store it" }),
    url: z.string().meta({ description: "The WebSocket URL to open" }),
    voice: z
      .string()
      .meta({ description: "The voice to set in `session.start` (`audio.output.voice`)" }),
  })
  .meta({ id: "LanguageConversationSetup" });

export type LanguageConversationSetup = z.infer<typeof languageConversationSetupSchema>;

export const languageConversationObjectiveCheckInputSchema = z
  .object({ turns: conversationTurnsSchema })
  .strict()
  .meta({ id: "LanguageConversationObjectiveCheckInput" });

export type LanguageConversationObjectiveCheckInput = z.infer<
  typeof languageConversationObjectiveCheckInputSchema
>;

export const languageConversationObjectiveCheckSchema = z
  .object({
    objectivesMet: z
      .array(z.string())
      .meta({ description: "Labels of every objective the learner has achieved so far" }),
  })
  .meta({ id: "LanguageConversationObjectiveCheck" });
