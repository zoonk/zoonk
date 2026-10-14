import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { findActiveGoalId } from "../../goals/_utils/goal-view";
import { type TutorSubject } from "./tutor-subject";

/**
 * The goal whose plan the buddy reads and changes in a thread: the plan's or the subject's own
 * goal, the goal a mock was taken for, and for a chapter, a lesson or a session's or practice's
 * question the learner's active goal, the one the Plan, the chapter's page and the buddy tab
 * show. Null for a learner without one.
 */
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
