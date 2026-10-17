import { ensureGuestSession } from "@/lib/guest/ensure-guest-session";
import { withLearnerWrite } from "@/lib/learner/learner-views";
import {
  type StartUnderstandingOutcome,
  type UnderstandingActions,
} from "@zoonk/learn/onboarding/actions";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import {
  getUnderstandingAction,
  retryUnderstandingAction,
  reviseUnderstandingAction,
  startUnderstandingAction,
} from "./understanding-actions";

/** A start or a retry saved the draft, whether its read started or not. */
function savedDraft(outcome: StartUnderstandingOutcome): boolean {
  return "draft" in outcome;
}

/**
 * Reading a typed goal from the web, on its own so the home page's goal box loads only this when
 * a visitor sends a goal. A visitor becomes a guest first, so the draft is theirs. Each saved draft
 * (started, tried again, corrected) is a write: the learner's other tabs read Today again, and
 * their card shows it.
 */
export const WEB_UNDERSTANDING_ACTIONS: UnderstandingActions = {
  get: getUnderstandingAction,
  retry: (draftId) => withLearnerWrite(() => retryUnderstandingAction(draftId), savedDraft),
  revise: ({ draftId, edit }) => withLearnerWrite(() => reviseUnderstandingAction(draftId, edit)),
  start: async (input) =>
    (await ensureGuestSession())
      ? withLearnerWrite(
          () => startUnderstandingAction({ ...input, timeZone: getLocalTimeZone() }),
          savedDraft,
        )
      : { status: "failed" },
};
