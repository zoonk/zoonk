import { type Attempt, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { bringBackMissedLessons } from "../../plans/bring-back-missed-lessons";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { type StudySessionRow } from "./study-session-access";

export async function retrySessionRecheck({
  attempt,
  session,
  timeZone: answerZone,
}: {
  attempt: Attempt;
  session: StudySessionRow;
  timeZone?: string | null;
}): Promise<void> {
  const { answer, isCorrect, skillId } = attempt;
  const { goalId } = session;

  if (
    isCorrect ||
    !goalId ||
    !skillId ||
    !isJsonObject(answer) ||
    answer.placementRecheck !== true
  ) {
    return;
  }

  const livingPlanDay = toIsoDate(session.localDate);

  const recorded = await prisma.planChange.findFirst({
    select: { id: true },
    where: {
      AND: [
        { payload: { equals: livingPlanDay, path: ["livingPlanDay"] } },
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
