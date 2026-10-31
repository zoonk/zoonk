import { ensureGuestSession } from "@/lib/guest/ensure-guest-session";
import { type UnderstandingActions } from "@zoonk/learn/onboarding/actions";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import {
  getUnderstandingAction,
  retryUnderstandingAction,
  reviseUnderstandingAction,
  startUnderstandingAction,
} from "./understanding-actions";

/** On its own, so the home page's goal box loads only this when a visitor sends a goal. */
export const WEB_UNDERSTANDING_ACTIONS: UnderstandingActions = {
  get: getUnderstandingAction,
  retry: retryUnderstandingAction,
  revise: ({ draftId, edit }) => reviseUnderstandingAction(draftId, edit),
  start: async (input) => {
    const guest = await ensureGuestSession();

    if (guest === "ready") {
      return startUnderstandingAction({ ...input, timeZone: getLocalTimeZone() });
    }

    if (guest === "cancelled") {
      return { status: "cancelled" };
    }

    return { status: guest === "blocked" ? "browserBlocked" : "failed" };
  },
};
