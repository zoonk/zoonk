import { getActiveGoalLimit, getUsageRule } from "./limits";

export function getFreePlanLimits() {
  const lessons = getUsageRule({ kind: "lessonStart", tier: "free" });

  return {
    activeGoals: getActiveGoalLimit("free"),
    guestLessons: getUsageRule({ kind: "lessonStart", tier: "guest" }).total ?? null,
    lessonsPer30Days: lessons.rolling30Days ?? null,
    tutorMessagesPerDay: getUsageRule({ kind: "tutorMessage", tier: "free" }).day ?? null,
    uploadsPerDay: getUsageRule({ kind: "upload", tier: "free" }).day ?? null,
  };
}
