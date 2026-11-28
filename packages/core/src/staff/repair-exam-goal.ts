import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { logInfo } from "@zoonk/utils/logger";
import { findOfferedChoices } from "../exams/choices/choose-exam-option";
import { type ExamChoice } from "../exams/choices/exam-choices";
import { loadExamPicks } from "../exams/choices/load-exam-choices";
import {
  type GoalAnswerInput,
  isInvalidGoalAnswer,
} from "../view-models/onboarding/_utils/onboarding-answer-details";
import { saveAnswerInputs } from "../view-models/onboarding/_utils/save-onboarding-answer";
import { settleGoalAnswer } from "../view-models/onboarding/answer-onboarding-question";
import { getAnsweredQuestions } from "../view-models/onboarding/onboarding-steps";

type Answer = { choice: ExamChoice } | { country: string };

type GoalAnswers = { contentCountry: string | null; examChoices: readonly ExamChoice[] };

type Refusal = { status: "conflict" | "invalid" | "notFound" | "unchanged" };

export type ExamGoalRepairResult =
  | { status: "conflict" | "invalid" | "notFound" }
  | { after: GoalAnswers; before: GoalAnswers; status: "applied" | "preview" | "unchanged" };

type Planned = Refusal | { after: GoalAnswers; input: GoalAnswerInput };

function planCountry({
  before,
  country,
  goal,
}: {
  before: GoalAnswers;
  country: string;
  goal: Goal;
}): Planned {
  const input = { country, question: "contentCountry" } as const;

  if (goal.contentCountry === country) {
    return { status: "unchanged" };
  }

  const details = isJsonObject(goal.details) ? goal.details : {};

  if (goal.contentCountry !== null || getAnsweredQuestions(details).includes("contentCountry")) {
    return { status: "conflict" };
  }

  return isInvalidGoalAnswer({ current: goal, input })
    ? { status: "invalid" }
    : { after: { ...before, contentCountry: country }, input };
}

async function planChoice({
  before,
  choice,
  goal,
}: {
  before: GoalAnswers;
  choice: ExamChoice;
  goal: Goal;
}): Promise<Planned> {
  const [offered] = (await findOfferedChoices({ choices: [choice], goal })) ?? [];

  if (!offered) {
    return { status: "invalid" };
  }

  const picked = before.examChoices.find(({ group }) => group === offered.group);

  if (picked) {
    return isDeepStrictEqual(picked.subjects, offered.subjects)
      ? { status: "unchanged" }
      : { status: "conflict" };
  }

  return {
    after: { ...before, examChoices: [...before.examChoices, offered] },
    input: { choices: [offered], question: "examChoice", timeZone: goal.timezone ?? undefined },
  };
}

async function readAnswers(goalId: string): Promise<GoalAnswers> {
  const [goal, picks] = await Promise.all([
    prisma.goal.findUniqueOrThrow({ select: { contentCountry: true }, where: { id: goalId } }),
    loadExamPicks(goalId),
  ]);

  return { contentCountry: goal.contentCountry, examChoices: picks.examChoices };
}

/**
 * Fills one answer an active exam goal is missing, for a release repair, only where the
 * learner's own words state it, and never over an answer the learner gave. It saves the
 * learner's own answer, so research, plan and curriculum follow as they would after it and
 * finished lessons stay. A preview writes nothing.
 */
export async function repairExamGoal({
  actor,
  answer,
  apply,
  goalId,
}: {
  actor: { clientId: string; userId: string };
  answer: Answer;
  apply: boolean;
  goalId: string;
}): Promise<ExamGoalRepairResult> {
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, kind: "exam", status: "active" },
  });

  if (!goal) {
    return { status: "notFound" };
  }

  const before = await readAnswers(goal.id);

  const planned =
    "country" in answer
      ? planCountry({ before, country: answer.country, goal })
      : await planChoice({ before, choice: answer.choice, goal });

  if ("status" in planned) {
    return planned.status === "unchanged"
      ? { after: before, before, status: "unchanged" }
      : { status: planned.status };
  }

  if (!apply) {
    return { after: planned.after, before, status: "preview" };
  }

  const saved = await saveAnswerInputs({ goal, input: planned.input });

  if (saved.status !== "saved") {
    return { status: saved.status === "notFound" ? "notFound" : "invalid" };
  }

  await settleGoalAnswer({ goal, goalIds: saved.goalIds, input: planned.input });

  const after = await readAnswers(goal.id);

  logInfo(
    JSON.stringify({
      actorUserId: actor.userId,
      after,
      before,
      clientId: actor.clientId,
      event: "staff.exam-goal-repair",
      goalId,
      learnerId: goal.userId,
    }),
  );

  return { after, before, status: "applied" };
}
