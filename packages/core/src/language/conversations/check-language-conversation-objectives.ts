import "server-only";
import { prisma } from "@zoonk/db";
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

  if (newlyMet.length > 0) {
    await prisma.languageConversation.updateMany({
      data: { objectivesMet: { push: newlyMet } },
      where: { id: row.id, status: "ready" },
    });
  }

  return {
    objectivesMet: getMetObjectives({
      labels: [...row.objectivesMet, ...newlyMet],
      objectives: scenario.objectives,
    }),
    status: "ready",
  };
}
