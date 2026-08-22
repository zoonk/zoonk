import { type GenerationQuotaPeriod } from "@zoonk/core/generation-quotas/contract";

export function getLessonQuestionLimitRetryAt({
  now,
  period,
}: {
  now: Date;
  period: GenerationQuotaPeriod;
}) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  if (period === "month") {
    return new Date(Date.UTC(year, month + 1, 1)).toISOString();
  }

  return new Date(Date.UTC(year, month, now.getUTCDate() + 1)).toISOString();
}
