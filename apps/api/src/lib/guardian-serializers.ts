import {
  type GuardedLearnerView,
  type GuardianLinkView,
} from "@zoonk/core/minors/guardian/contract";
import { serializeDate } from "@zoonk/utils/date";

const ISO_DATE_LENGTH = 10;

export function serializeGuardianLink(link: GuardianLinkView) {
  return {
    acceptedAt: serializeDate(link.acceptedAt),
    createdAt: link.createdAt.toISOString(),
    dailyLimitMinutes: link.dailyLimitMinutes,
    expiresAt: serializeDate(link.expiresAt),
    guardianEmail: link.guardianEmail,
    id: link.id,
    plusApprovedAt: serializeDate(link.plusApprovedAt),
    status: link.status,
  };
}

/** Days are the learner's local calendar dates, so they're sent without a time. */
export function serializeGuardedLearner(learner: GuardedLearnerView) {
  return {
    ...learner,
    plusApprovedAt: serializeDate(learner.plusApprovedAt),
    weeklyActivity: {
      ...learner.weeklyActivity,
      days: learner.weeklyActivity.days.map((day) => ({
        ...day,
        date: day.date.toISOString().slice(0, ISO_DATE_LENGTH),
      })),
    },
  };
}
