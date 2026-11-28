import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isCountryCode } from "@zoonk/utils/countries";
import { isJsonObject } from "@zoonk/utils/json";
import { logInfo } from "@zoonk/utils/logger";
import { findOfferedChoices } from "../exams/choices/choose-exam-option";
import { type ExamChoice } from "../exams/choices/exam-choices";
import { loadExamPicks } from "../exams/choices/load-exam-choices";
import { isCountryGoal } from "../goals/_utils/goal-content-country";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { saveGoalAnswer } from "../view-models/onboarding/answer-onboarding-question";

type Answers = { choices?: ExamChoice[]; country?: string };

type GoalAnswers = { contentCountry: string | null; examChoices: readonly ExamChoice[] };

export type ExamGoalRepairResult =
  | { status: "invalid" | "notFound" }
  | { after: GoalAnswers; before: GoalAnswers; status: "applied" | "failed" | "preview" };

async function findExamGoal(goalId: string): Promise<Goal | null> {
  return prisma.goal.findFirst({ where: { id: goalId, kind: "exam", status: "active" } });
}

async function readAnswers(goal: Goal): Promise<GoalAnswers> {
  const picks = await loadExamPicks(goal.id);
  return { contentCountry: goal.contentCountry, examChoices: picks.examChoices };
}

/**
 * A goal read before exams recorded whether their country matters has no such reading, so a
 * country answer would be refused. The learner's words naming one say it does.
 */
async function markCountryDependent(goal: Goal): Promise<void> {
  await writeLearnerChange(
    { goalIds: [goal.id], planInputs: true, userId: goal.userId },
    async (tx) => {
      const current = await tx.goal.findUniqueOrThrow({ where: { id: goal.id } });

      if (isCountryGoal(current)) {
        return unchanged(null);
      }

      const details = isJsonObject(current.details) ? current.details : {};

      return tx.goal.update({
        data: { details: { ...details, countryDependent: true } },
        where: { id: goal.id },
      });
    },
  );
}

async function saveAnswers({ choices, country, goal }: Answers & { goal: Goal }): Promise<boolean> {
  if (country) {
    await markCountryDependent(goal);

    const current = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

    const saved = await saveGoalAnswer({
      goal: current,
      input: { country, question: "contentCountry" },
    });

    if (saved.status !== "saved") {
      return false;
    }
  }

  if (choices) {
    const current = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

    const saved = await saveGoalAnswer({
      goal: current,
      input: { choices, question: "examChoice", timeZone: current.timezone ?? undefined },
    });

    return saved.status === "saved";
  }

  return true;
}

/**
 * Saves an active exam goal's country or exam options for a release repair, only where the
 * learner's own words state them: through the learner's own answer, so research, plan and
 * curriculum follow as they would after it and finished lessons stay. A preview writes nothing.
 */
export async function repairExamGoal({
  actor,
  apply,
  choices,
  country,
  goalId,
}: Answers & {
  actor: { clientId: string; userId: string };
  apply: boolean;
  goalId: string;
}): Promise<ExamGoalRepairResult> {
  const goal = await findExamGoal(goalId);

  if (!goal) {
    return { status: "notFound" };
  }

  const offered = choices ? await findOfferedChoices({ choices, goal }) : undefined;

  if ((country && !isCountryCode(country)) || offered === null) {
    return { status: "invalid" };
  }

  const before = await readAnswers(goal);

  if (!apply) {
    return {
      after: {
        contentCountry: country ?? before.contentCountry,
        examChoices: offered ?? before.examChoices,
      },
      before,
      status: "preview",
    };
  }

  const saved = await saveAnswers({ choices: offered, country, goal });
  const updated = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
  const after = await readAnswers(updated);
  const status = saved ? "applied" : "failed";

  logInfo(
    JSON.stringify({
      actorUserId: actor.userId,
      after,
      before,
      clientId: actor.clientId,
      event: "staff.exam-goal-repair",
      goalId,
      learnerId: goal.userId,
      status,
    }),
  );

  return { after, before, status };
}
