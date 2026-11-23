import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { z } from "zod";

export const LEVEL_WINDOW_ANSWERS = 20;
export const RISE_ACCURACY = 0.85;
export const DROP_ACCURACY = 0.5;

const closedWindowSchema = z.object({
  at: z.iso.datetime(),
  levelTestOut: z.enum(CEFR_LEVELS).optional(),
  missedSkillIds: z.array(z.string()),
  result: z.enum(["easy", "steady", "hard"]),
  score: z.number().optional(),
  sessionDay: z.iso.date().optional(),
  streak: z.int().min(1),
});

const livingPlanWindowSchema = z.object({
  closed: closedWindowSchema.nullable(),
  correct: z.int().min(0),
  missedSkillIds: z.array(z.string()),
  total: z
    .int()
    .min(0)
    .max(LEVEL_WINDOW_ANSWERS - 1),
});

type LivingPlanWindow = z.infer<typeof livingPlanWindowSchema>;

export type ClosedLivingPlanWindow = z.infer<typeof closedWindowSchema>;

export type LessonWindowAnswer = { isCorrect: boolean; skillId: string | null };

export function readLivingPlanWindow(value: unknown): LivingPlanWindow {
  return (
    livingPlanWindowSchema.safeParse(value).data ?? {
      closed: null,
      correct: 0,
      missedSkillIds: [],
      total: 0,
    }
  );
}

function windowResult(accuracy: number): ClosedLivingPlanWindow["result"] {
  if (accuracy >= RISE_ACCURACY) {
    return "easy";
  }

  return accuracy < DROP_ACCURACY ? "hard" : "steady";
}

function recordAnswer({
  answer,
  at,
  sessionDay,
  state,
}: {
  answer: LessonWindowAnswer;
  at: string;
  sessionDay?: string;
  state: LivingPlanWindow;
}): LivingPlanWindow {
  const total = state.total + 1;
  const correct = state.correct + Number(answer.isCorrect);

  const missedSkillIds =
    answer.isCorrect || !answer.skillId
      ? state.missedSkillIds
      : [...new Set([...state.missedSkillIds, answer.skillId])];

  if (total < LEVEL_WINDOW_ANSWERS) {
    return { ...state, correct, missedSkillIds, total };
  }

  const accuracy = correct / total;
  const result = windowResult(accuracy);
  const streak = state.closed?.result === result ? state.closed.streak + 1 : 1;

  return {
    closed: {
      at,
      missedSkillIds: result === "hard" ? missedSkillIds : [],
      result,
      ...(sessionDay && { sessionDay }),
      streak,
    },
    correct: 0,
    missedSkillIds: [],
    total: 0,
  };
}

export function recordLivingPlanAnswers({
  answers,
  at,
  sessionDay,
  stored,
}: {
  answers: readonly LessonWindowAnswer[];
  at: Date;
  sessionDay?: string;
  stored: unknown;
}): LivingPlanWindow {
  const closedAt = at.toISOString();

  return answers.reduce(
    (state, answer) => recordAnswer({ answer, at: closedAt, sessionDay, state }),
    readLivingPlanWindow(stored),
  );
}
