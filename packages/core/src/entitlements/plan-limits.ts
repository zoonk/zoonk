import { getActiveGoalLimit, getExamPrepAccess, getUsageRule } from "./limits";

/**
 * What the free plan includes, read from the same rules the allowance enforces, so the pricing
 * page and paywalls can't promise more or less than a learner gets. Guests can try a few lessons
 * before creating an account.
 */
export function getFreePlanLimits() {
  const lessons = getUsageRule({ kind: "lessonStart", tier: "free" });

  return {
    activeGoals: getActiveGoalLimit("free"),
    conversationsPerDay: getUsageRule({ kind: "conversation", tier: "free" }).day ?? null,
    examPrepDays: getExamPrepAccess("free").studyDays,
    guestLessons: getUsageRule({ kind: "lessonStart", tier: "guest" }).total ?? null,
    lessonsPerDay: lessons.day ?? null,
    lessonsPerMonth: lessons.month ?? null,
    tutorMessagesPerDay: getUsageRule({ kind: "tutorMessage", tier: "free" }).day ?? null,
    uploadsPerDay: getUsageRule({ kind: "upload", tier: "free" }).day ?? null,
  };
}
