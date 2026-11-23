import { type Attempt, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { bringBackMissedLessons } from "../../plans/bring-back-missed-lessons";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { type StudySessionRow } from "./study-session-access";

export async function settleSavedSessionRecheck({
  attempt,
  session,
  timeZone: answerZone,
}: {
  attempt: Attempt;
  session: StudySessionRow;
  timeZone?: string | null;
}): Promise<void> {
  const { answer, answeredAt, isCorrect, skillId } = attempt;
  const { goalId } = session;

  if (isCorrect || !goalId || !skillId || !isJsonObject(answer)) {
    return;
  }

  const recheck = answer.placementRecheck === true;

  if (!recheck && answer.passedOverMiss !== true) {
    return;
  }

  const livingPlanDay = recheck ? toIsoDate(session.localDate) : undefined;

  const recorded = await prisma.planChange.findFirst({
    select: { id: true },
    where: {
      AND: [
        livingPlanDay
          ? { payload: { equals: livingPlanDay, path: ["livingPlanDay"] } }
          : { createdAt: { gte: answeredAt } },
        { payload: { array_contains: [skillId], path: ["recheckedSkillIds"] } },
      ],
      kind: "relearn",
      plan: { goalId },
    },
  });

  if (recorded) {
    return;
  }

  await bringBackMissedLessons({
    goalId,
    livingPlanDay,
    now: new Date(),
    skillIds: [skillId],
    timeZone: getAnswerTimeZone({ goal: session.goal, timeZone: answerZone }),
  });
}
