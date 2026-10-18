import "server-only";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { getSession } from "../../users/get-session";
import { readSavedScenario } from "./_utils/conversation-view";
import { findNewlyMetObjectives } from "./_utils/objective-check";
import { type LanguageConversationObjectiveCheckInput } from "./conversation-contract";
import { getMetObjectives } from "./conversation-rules";
import { findOwnedConversation } from "./get-language-conversation";

const MS_PER_MINUTE = 60_000;

/** Checks run while the call does: its length, the goodbye and a reconnect. */
const LATE_CHECK_MS = 180_000;

export type CheckLanguageConversationObjectivesResult =
  | { objectivesMet: string[]; status: "ready" }
  | { status: "conversationEnded" | "invalid" | "notFound" | "unauthorized" };

/**
 * Marks a live call's objectives while the learner talks: the app sends what was said so far after
 * each of the learner's turns, a separate text model says which open objectives the learner's own
 * words achieved, and those stay met for the rest of the call. Only for a connected call that is
 * still running. Returns every objective met so far.
 */
export async function checkLanguageConversationObjectives({
  conversationId,
  input,
}: {
  conversationId: string;
  input: LanguageConversationObjectiveCheckInput;
}): Promise<CheckLanguageConversationObjectivesResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const owned = await findOwnedConversation({ conversationId, userId });

  if (!owned) {
    return { status: "notFound" };
  }

  const { row } = owned;
  const scenario = readSavedScenario(row);

  if (row.status !== "ready") {
    return { status: "conversationEnded" };
  }

  if (!scenario || !row.startedAt) {
    return { status: "invalid" };
  }

  if (Date.now() > row.startedAt.getTime() + row.minutes * MS_PER_MINUTE + LATE_CHECK_MS) {
    return { status: "conversationEnded" };
  }

  // An exam task's one goal is the task itself, graded once it ends: no model reads it before.
  const newlyMet = scenario.examTask
    ? []
    : await findNewlyMetObjectives({ row, scenario, turns: input.turns, userId });

  // Read the goals met again under the revision lock: an overlapping check may have just marked
  // the same one, and a call that ended meanwhile keeps its goals. Either changes nothing.
  const labels =
    newlyMet.length === 0
      ? row.objectivesMet
      : await writeLearnerChange({ userId }, async (tx) => {
          const current = await tx.languageConversation.findUniqueOrThrow({
            select: { objectivesMet: true, status: true },
            where: { id: row.id },
          });

          const fresh = newlyMet.filter((label) => !current.objectivesMet.includes(label));

          if (current.status !== "ready" || fresh.length === 0) {
            return unchanged(current.objectivesMet);
          }

          // Completion doesn't take the revision lock: the status guard keeps a call that just
          // ended from gaining goals after its rewards were counted.
          const { count } = await tx.languageConversation.updateMany({
            data: { objectivesMet: { push: fresh } },
            where: { id: row.id, status: "ready" },
          });

          return count > 0
            ? [...current.objectivesMet, ...fresh]
            : unchanged(current.objectivesMet);
        });

  return {
    objectivesMet: getMetObjectives({ labels, objectives: scenario.objectives }),
    status: "ready",
  };
}
