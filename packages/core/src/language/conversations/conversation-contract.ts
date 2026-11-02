import { SPEAKING_MOCK_EXAMS } from "@zoonk/ai/tasks/language/exam-speaking-exams";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { z } from "zod";
import { answerTimeZoneSchema } from "../../learner/contract";
import { activityBrainPowerSchema, missionMomentSchema } from "../../sessions/completion-contract";
import { progressCelebrationShape } from "../../sessions/progress-celebration";
import {
  examSpeakingFeedbackSchema,
  examSpeakingFeedbackViewSchema,
  examTaskSnapshotSchema,
  examTaskViewSchema,
} from "../exam-speaking/speaking-contract";
import { isWebRtcAudioOffer } from "./_utils/webrtc-offer";
import { callFeedbackSchema, speakingMockFeedbackSchema } from "./call-feedback-contract";
import { MAX_CONVERSATION_TURNS, MAX_CONVERSATION_TURN_LENGTH } from "./conversation-turn-limits";
import { liveCallCueSchema, liveCallScriptSchema } from "./live-call-script-contract";

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

export const conversationFeedbackSchema = z.discriminatedUnion("kind", [
  callFeedbackSchema,
  speakingMockFeedbackSchema,
  examSpeakingFeedbackSchema,
]);

export type ConversationFeedback = z.infer<typeof conversationFeedbackSchema>;

const conversationFeedbackViewSchema = z.discriminatedUnion("kind", [
  callFeedbackSchema,
  speakingMockFeedbackSchema,
  examSpeakingFeedbackViewSchema,
]);

export type ConversationFeedbackView = z.infer<typeof conversationFeedbackViewSchema>;
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
        feedback: conversationFeedbackViewSchema.nullable(),
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
    script: liveCallScriptSchema,
    seconds: z
      .int()
      .positive()
      .meta({
        description:
          "How long until the server hangs up, from when its answer arrived, whatever the device's clock says: the hard stop",
      }),
    sessionUrl: z.string(),
    talkSeconds: z
      .int()
      .positive()
      .meta({
        description:
          "The talk time left when the server answered: start ending the call this long after the answer arrived. `seconds` adds the wrap-up for the goodbye",
      }),
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
    goodbye: z
      .boolean()
      .meta({
        description:
          "The transcript sent ends with the learner and the character saying goodbye to each other: end the call without a goodbye cue, unless the learner spoke or typed after sending it",
      }),
    objectivesMet: z
      .array(z.string())
      .meta({ description: "Labels of every objective the learner has achieved so far" }),
    progress: liveCallCueSchema
      .nullable()
      .meta({
        description:
          "Tell the character what the learner achieved: null when this check found nothing new or every objective is met",
      }),
  })
  .meta({ id: "LanguageConversationObjectiveCheck" });

export type LanguageConversationObjectiveCheck = z.infer<
  typeof languageConversationObjectiveCheckSchema
>;
