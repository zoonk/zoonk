import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { findActiveGoalId } from "../../goals/_utils/goal-view";
import { type TutorSubject } from "./tutor-subject";

/** Screen subjects use the learner's active goal; plan/subject/mock targets retain their own goal. Null without one. */
export async function findSubjectGoal({
  subject,
  userId,
}: {
  subject: TutorSubject;
  userId: string;
}): Promise<Goal | null> {
  if (subject.kind === "plan" || subject.kind === "subject") {
    return subject.goal;
  }

  const goalId =
    (subject.kind === "mock" ? subject.goalId : null) ?? (await findActiveGoalId(userId));

  return goalId ? prisma.goal.findFirst({ where: { id: goalId, userId } }) : null;
}
