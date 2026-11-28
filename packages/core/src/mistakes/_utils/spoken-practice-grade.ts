import "server-only";
import { type Attempt, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import {
  type GradeSpokenAnswerResult,
  spokenAnswerGradeSchema,
} from "../../library/language/spoken-answer-contract";
import { finishPracticeAnswer, readPracticeFeedback } from "./practice-feedback";

export const recordingGradeSchema = spokenAnswerGradeSchema.omit({
  attemptId: true,
  practice: true,
});

export type RecordingInput = Parameters<typeof finishPracticeAnswer>[0]["input"] & {
  timeZone: string;
};

export async function replaySpokenPractice({
  attempt,
  input,
  mistakeId,
}: {
  attempt: Attempt;
  input: RecordingInput;
  mistakeId: string;
}): Promise<GradeSpokenAnswerResult | null> {
  const feedback = readPracticeFeedback(attempt);

  if (!feedback) {
    return null;
  }

  const cached = await prisma.modelGrade.findUnique({ where: { id: attempt.id } });

  const grade = recordingGradeSchema.safeParse(
    isJsonObject(cached?.result) ? cached.result.grade : null,
  );

  if (!grade.success) {
    return null;
  }

  const practice = await finishPracticeAnswer({ attempt, feedback, input, mistakeId });
  return { grade: { ...grade.data, attemptId: attempt.id, practice }, status: "graded" };
}
