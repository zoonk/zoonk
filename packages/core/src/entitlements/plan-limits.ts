import { getActiveGoalLimit, getExamPrepAccess, getUsageRule } from "./limits";

export function getFreePlanLimits() {
  const lessons = getUsageRule({ kind: "lessonStart", tier: "free" });

  return {
    activeGoals: getActiveGoalLimit("free"),
    examPrepDays: getExamPrepAccess("free").studyDays,
    guestLessons: getUsageRule({ kind: "lessonStart", tier: "guest" }).total ?? null,
    lessonsPerDay: lessons.day ?? null,
    lessonsPerMonth: lessons.month ?? null,
    tutorMessagesPerDay: getUsageRule({ kind: "tutorMessage", tier: "free" }).day ?? null,
    uploadsPerDay: getUsageRule({ kind: "upload", tier: "free" }).day ?? null,
  };
}
