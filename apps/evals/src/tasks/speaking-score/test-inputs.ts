import { type ConversationTurn } from "@zoonk/ai/tasks/v2/language/conversation-feedback";
import {
  type SpeakingExam,
  type SpeakingMockExam,
} from "@zoonk/ai/tasks/v2/language/exam-speaking-exams";
import { type ScoreSpeakingParams } from "@zoonk/ai/tasks/v2/language/speaking-score";
import { getSpeakingMockRating } from "@zoonk/core/language/conversations/speaking-mock";
import {
  getSpeakingFormat,
  getSpeakingTask,
  listTaskCriteria,
} from "@zoonk/core/language/exam-speaking/formats";
import { type CefrLevel } from "@zoonk/utils/cefr";

export type SpeakingScoreInput = Omit<
  ScoreSpeakingParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

type CallFields = { learnerLanguage: string; spokenSeconds: number; turns: ConversationTurn[] };

/** A mock's input as core passes it: the whole test on its exam's criteria. */
export function mockInput({ exam, ...rest }: CallFields & { exam: SpeakingMockExam }) {
  return { ...rest, ...getSpeakingMockRating(exam), exam };
}

/** A task's input as core passes it: the paper's title, the task and its criteria from the format table. */
export function examTask({
  exam,
  level,
  task,
  ...rest
}: CallFields & { exam: SpeakingExam; level: CefrLevel; task: string }): SpeakingScoreInput {
  const format = getSpeakingFormat({ exam, level });
  const found = format ? getSpeakingTask({ format, task }) : null;

  if (!format || !found) {
    throw new Error(`No ${exam} ${level} task ${task}`);
  }

  return {
    ...rest,
    criteria: listTaskCriteria({ format, task }),
    exam,
    level,
    task: { brief: found.brief, minutes: found.minutes, name: found.name, role: found.role },
    title: format.title,
  };
}
