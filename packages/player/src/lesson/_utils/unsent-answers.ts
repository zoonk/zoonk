import { lessonStepAnswerSchema } from "@zoonk/core/lesson-player/contract";
import { deviceStorage } from "@zoonk/learn/device-storage";
import { z } from "zod";

const unsentAnswerSchema = z.object({
  answer: lessonStepAnswerSchema,
  answeredAt: z.iso.datetime(),
  attemptId: z.string(),
  durationMs: z.number(),
  isCorrect: z.boolean(),
  runId: z.string(),
  stepId: z.string(),
  usedHelp: z.boolean(),
});

export type UnsentAnswer = z.infer<typeof unsentAnswerSchema>;

type LearnerLesson = { learnerId: string; lessonId: string };

function getKey({ attemptId, learnerId, lessonId }: LearnerLesson & { attemptId: string }) {
  return `lesson-unsent:${learnerId}:${lessonId}:${attemptId}`;
}

/** Oldest first; entries that don't parse are left out. */
export function readUnsentAnswers({ learnerId, lessonId }: LearnerLesson): UnsentAnswer[] {
  return deviceStorage
    .keys(getKey({ attemptId: "", learnerId, lessonId }))
    .flatMap((key) => {
      const parsed = unsentAnswerSchema.safeParse(deviceStorage.getJson(key));
      return parsed.success ? [parsed.data] : [];
    })
    .toSorted((first, second) => Date.parse(first.answeredAt) - Date.parse(second.answeredAt));
}

export function keepUnsentAnswer({ answer, ...lesson }: LearnerLesson & { answer: UnsentAnswer }) {
  deviceStorage.set(getKey({ ...lesson, attemptId: answer.attemptId }), JSON.stringify(answer));
}

export function dropUnsentAnswer(entry: LearnerLesson & { attemptId: string }) {
  deviceStorage.remove(getKey(entry));
}
