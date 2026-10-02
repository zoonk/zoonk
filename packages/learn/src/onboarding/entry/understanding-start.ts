import { safeAsync } from "@zoonk/utils/error";
import { type StartUnderstandingOutcome, type UnderstandingActions } from "../onboarding-actions";

/**
 * The goal the learner just sent, kept for this tab across the move from the home page to
 * `/start`: when they sent it, for "Goal Classified", and proof that the next step follows their
 * own tap, so a question goes on to its explanation by itself. Taken once: a later refresh finds
 * nothing and waits for a tap instead. Storage can be off (a private window); then the page simply
 * asks for the tap.
 */

const KEY_PREFIX = "zoonk:goal-sent:";

/** Older than this, it wasn't this visit's tap. */
const MAX_AGE_MS = 10 * 60 * 1000;

function rememberGoalSent({ draftId, sentAt }: { draftId: string; sentAt: number }) {
  try {
    sessionStorage.setItem(`${KEY_PREFIX}${draftId}`, String(sentAt));
  } catch {
    // Without storage the page waits for a tap.
  }
}

/** When the learner sent this draft's goal in this tab, once; null after that or if never. */
export function takeGoalSent(draftId: string): number | null {
  try {
    const key = `${KEY_PREFIX}${draftId}`;
    const sentAt = Number(sessionStorage.getItem(key));
    sessionStorage.removeItem(key);

    return sentAt > 0 && Date.now() - sentAt < MAX_AGE_MS ? sentAt : null;
  } catch {
    return null;
  }
}

/**
 * Sends a typed goal to be read, from wherever the learner typed it (the home page's goal box or
 * `/start`): it's saved as a draft and its run starts, and the tap is remembered for `/start`.
 */
export async function sendGoal({
  goal,
  language,
  understanding,
}: {
  goal: string;
  language: string;
  understanding: Pick<UnderstandingActions, "start">;
}): Promise<StartUnderstandingOutcome> {
  const sentAt = Date.now();
  const { data } = await safeAsync(() => understanding.start({ goal, language }));
  const outcome: StartUnderstandingOutcome = data ?? { status: "failed" };

  if (outcome.status === "started" || outcome.status === "startFailed") {
    rememberGoalSent({ draftId: outcome.draft.id, sentAt });
  }

  return outcome;
}
