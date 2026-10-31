import "server-only";
import { after } from "next/server";
import { trackLearnerEvents } from "./track-learner-event";

export function trackPlanEdited({
  changeKind,
  enabled = true,
  goalId,
  userId,
}: {
  changeKind: string;
  enabled?: boolean;
  goalId: string;
  userId: string;
}): void {
  if (!enabled) {
    return;
  }

  after(() =>
    trackLearnerEvents({
      events: [{ name: "Plan Edited", properties: { change_kind: changeKind } }],
      goalId,
      userId,
    }),
  );
}
