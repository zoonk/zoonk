import "server-only";
import { type LanguageConversation, prisma } from "@zoonk/db";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { getSession } from "../../users/get-session";
import { readSavedScenario } from "./_utils/conversation-view";
import { getObjectivesProgressCue } from "./_utils/live-call-script";
import { NOTHING_FOUND, type ObjectiveCheck, runObjectiveCheck } from "./_utils/objective-check";
import {
  type LanguageConversationObjectiveCheck,
  type LanguageConversationObjectiveCheckInput,
} from "./conversation-contract";
import { getMetObjectives } from "./conversation-rules";
import { findOwnedConversation } from "./get-language-conversation";

/** The exchange before a check's new turns, so a short answer reads with its question. */
const CONTEXT_TURNS = 2;

/** About the exchanges a minute of talk holds; past them, the call's review still reads it all. */
const CHECKS_PER_CALL_MINUTE = 4;

/**
 * Claims the turns after the ones the connection's checks have read, from exactly the count this
 * request read, before the model runs: a transcript sent again or at once asks no model, and a
 * call's checks read its transcript about once, a few times a minute at most.
 */
async function checkNewTurns({
  connectionId,
  row,
  ...check
}: Parameters<typeof runObjectiveCheck>[0] & {
  connectionId: string;
  row: Pick<LanguageConversation, "checkedConnectionId" | "checkedTurns" | "id" | "minutes">;
}): Promise<ObjectiveCheck> {
  const checked = row.checkedConnectionId === connectionId ? row.checkedTurns : 0;

  if (check.turns.length <= checked) {
    return NOTHING_FOUND;
  }

  const { count } = await prisma.languageConversation.updateMany({
    data: {
      checkedConnectionId: connectionId,
      checkedTurns: check.turns.length,
      objectiveChecks: { increment: 1 },
    },
    where: {
      checkedConnectionId: row.checkedConnectionId,
      checkedTurns: row.checkedTurns,
      id: row.id,
      objectiveChecks: { lt: row.minutes * CHECKS_PER_CALL_MINUTE },
    },
  });

  if (count === 0) {
    return NOTHING_FOUND;
  }

  const turns = check.turns.slice(Math.max(0, checked - CONTEXT_TURNS));
  return runObjectiveCheck({ ...check, row, turns });
}

export type CheckLanguageConversationObjectivesResult =
  | { check: LanguageConversationObjectiveCheck; status: "ready" }
  | { status: "conversationEnded" | "invalid" | "notFound" | "unauthorized" };

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

  if (!scenario) {
    return { status: "invalid" };
  }

  const [connection] = await prisma.liveCallConnection.updateManyAndReturn({
    data: { lastActiveAt: new Date() },
    select: { id: true },
    where: { conversationId: row.id, id: input.connectionId, state: "live", userId },
  });

  if (!connection) {
    return { status: "invalid" };
  }

  const found = scenario.examTask
    ? NOTHING_FOUND
    : await checkNewTurns({
        connectionId: connection.id,
        row,
        scenario,
        turns: input.turns,
        userId,
      });

  const newlyMet = found.met;

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

          const { count } = await tx.languageConversation.updateMany({
            data: { objectivesMet: { push: fresh } },
            where: { id: row.id, status: "ready" },
          });

          return count > 0
            ? [...current.objectivesMet, ...fresh]
            : unchanged(current.objectivesMet);
        });

  const objectivesMet = getMetObjectives({ labels, objectives: scenario.objectives });

  const open = scenario.objectives
    .map((objective) => objective.label)
    .filter((label) => !objectivesMet.includes(label));

  return {
    check: {
      goodbye: found.goodbye,
      objectivesMet,
      progress:
        !found.goodbye && labels.length > row.objectivesMet.length
          ? getObjectivesProgressCue({ met: objectivesMet, open })
          : null,
    },
    status: "ready",
  };
}
