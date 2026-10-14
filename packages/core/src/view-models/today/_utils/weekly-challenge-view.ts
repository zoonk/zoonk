import { type WeeklyChallengeResult } from "../../../checkpoints/get-weekly-challenge";
import { type TodayView } from "../get-today-view";

/** The actual weekly checkpoint's card, without exposing its preparation payload. */
export function toWeeklyChallenge(result: WeeklyChallengeResult): TodayView["weeklyChallenge"] {
  if (result.status !== "ready" || !result.challenge) {
    return null;
  }

  const { challenge } = result;

  return {
    access: challenge.access,
    date: challenge.date,
    kind: challenge.kind,
    planItemId: challenge.planItemId,
    questions: challenge.questions,
    timeLimitMinutes: challenge.conditions?.timeLimitMinutes ?? null,
    title: challenge.title,
  };
}
