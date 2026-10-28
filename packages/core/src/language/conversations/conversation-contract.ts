import { SPEAKING_MOCK_EXAMS } from "@zoonk/ai/tasks/v2/language/exam-speaking-exams";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { z } from "zod";
import { answerTimeZoneSchema } from "../../learner/contract";
import { activityBrainPowerSchema, missionMomentSchema } from "../../sessions/completion-contract";
import { progressCelebrationShape } from "../../sessions/progress-celebration";
import {
  examSpeakingFeedbackSchema,
  examTaskSnapshotSchema,
  examTaskViewSchema,
} from "../exam-speaking/speaking-contract";
import { isWebRtcAudioOffer } from "./_utils/webrtc-offer";
import { MAX_CONVERSATION_TURNS, MAX_CONVERSATION_TURN_LENGTH } from "./conversation-turn-limits";
import { SPEAKING_MOCK_CRITERIA, SPEAKING_MOCK_SCALES } from "./speaking-mock-format";

const MAX_SDP_LENGTH = 100_000;
const MAX_PRACTICE_MINUTES = 5;

const MAX_CALL_MINUTES = 20;

export const PRACTICE_CONVERSATION_MINUTES = [1, 2, 3, MAX_PRACTICE_MINUTES] as const;
const MAX_SPOKEN_SECONDS = 1260;

const speakerSchema = z.enum(["learner", "character"]);

export const speakingMockExamSchema = z.enum(SPEAKING_MOCK_EXAMS).meta({ id: "SpeakingMockExam" });

export type SpeakingMockExam = z.infer<typeof speakingMockExamSchema>;

const conversationTurnSchema = z
  .object({
    speaker: speakerSchema,
    text: z.string().trim().min(1).max(MAX_CONVERSATION_TURN_LENGTH),
  })
  .meta({ id: "LanguageConversationTurn" });

export type ConversationTurn = z.infer<typeof conversationTurnSchema>;

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

export const speakingMockScenarioSchema = conversationScenarioSchema.extend({
  exam: speakingMockExamSchema,
});

export const examSpeakingScenarioSchema = conversationScenarioSchema.extend({
  examTask: examTaskSnapshotSchema,
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

const HALF_BAND = 0.5;

function speakingMockFeedbackFor<const TExam extends SpeakingMockExam>(exam: TExam) {
  const { halfBands, maxBand, minBand } = SPEAKING_MOCK_SCALES[exam];
  const step = halfBands ? HALF_BAND : 1;
  const band = z.number().min(minBand).max(maxBand).multipleOf(step);
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
  examSpeakingFeedbackSchema,
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
    z
      .object({
        goalId: z
          .uuid()
          .meta({
            description:
              "A goal preparing for DELE, DELF or DALF, a Goethe-Zertifikat or Cambridge English, in that exam's language (`speaking` on the goal's exam or language view)",
          }),
        kind: z.literal("examSpeaking"),
        task: z
          .string()
          .min(1)
          .max(10)
          .meta({
            description: "The task's key in the exam's speaking paper (`speaking.tasks[].key`)",
          }),
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
    connectionId: z
      .uuid()
      .meta({
        description:
          "The originating connection reservation; preserve it when completing this attempt",
      }),
    spokenSeconds: z.int().min(0).max(MAX_SPOKEN_SECONDS),
    timeZone: answerTimeZoneSchema,
    turns: conversationTurnsSchema,
    usedHelp: z.boolean().meta({ description: "The learner used Help" }),
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
    examTask: examTaskViewSchema
      .nullable()
      .meta({
        description: "The exam task an `examSpeaking` call practices; null for other calls",
      }),
    goalId: z.uuid().nullable(),
    hints: z.array(z.string()),
    id: z.uuid(),
    kind: z.enum(["practice", "checkpoint", "speakingMock", "examSpeaking"]),
    level: z.enum(CEFR_LEVELS),
    locked: z
      .boolean()
      .meta({
        description:
          "A checkpoint call (including a completed result) or an unfinished certificate exam speaking call requires Plus; completed feedback remains readable and practice calls are never locked",
      }),
    minutes: z.int().min(1).max(MAX_CALL_MINUTES),
    objectives: z.array(objectiveViewSchema),
    openingLine: z.string(),
    result: z
      .object({
        brainPower: activityBrainPowerSchema,
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

export const completedLanguageConversationSchema = languageConversationViewSchema
  .extend({ ...progressCelebrationShape, missionMoment: missionMomentSchema.nullable() })
  .meta({ id: "CompletedLanguageConversation" });

export type CompletedLanguageConversation = z.infer<typeof completedLanguageConversationSchema>;

export const languageConversationSetupSchema = z
  .object({
    connectionId: z.uuid(),
    deadlineAt: z.iso.datetime().meta({ description: "When the server hangs the call up" }),
    endsAtLimit: z.enum(["day", "month"]).nullable(),
    seconds: z
      .int()
      .positive()
      .meta({
        description:
          "The call time left when the server answered: end the call this long after the answer arrived, whatever the device's clock says",
      }),
    sessionUrl: z.string(),
    voice: z.string(),
  })
  .meta({ id: "LanguageConversationSetup" });

export type LanguageConversationSetup = z.infer<typeof languageConversationSetupSchema>;

export const languageConversationConnectInputSchema = z
  .object({
    takeover: z
      .boolean()
      .optional()
      .meta({ description: "End the learner's call in another conversation first" }),
  })
  .strict()
  .meta({ id: "LanguageConversationConnectInput" });
export type LanguageConversationConnectInput = z.infer<
  typeof languageConversationConnectInputSchema
>;

export const liveCallSdpInputSchema = z
  .object({
    sdp: z
      .string()
      .min(1)
      .max(MAX_SDP_LENGTH)
      .refine(isWebRtcAudioOffer, { message: "Expected a WebRTC offer with an audio section" })
      .meta({ description: "The browser's WebRTC SDP offer, with an audio section" }),
    sessionConfig: z
      .unknown()
      .optional()
      .meta({ description: "Ignored: configuration is owned by the server" }),
  })
  .strict()
  .meta({ id: "LiveCallSdpInput" });
export type LiveCallSdpInput = z.infer<typeof liveCallSdpInputSchema>;
export const liveCallSdpResponseSchema = z
  .object({ sdp: z.string(), sessionId: z.string() })
  .meta({ id: "LiveCallSdpResponse" });

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
