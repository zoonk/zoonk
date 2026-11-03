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

const MS_PER_MINUTE = 60_000;

const LATE_CHECK_MS = 180_000;

/** The exchange before a check's new turns, so a short answer reads with its question. */
const CONTEXT_TURNS = 2;

/** About the exchanges a minute of talk holds; past them, the call's review still reads it all. */
const CHECKS_PER_CALL_MINUTE = 4;

/**
 * Claims the turns after the ones the call's checks have read, from exactly the count this
 * request read, before the model runs: a transcript sent again or at once asks no model, and a
 * call's checks read its transcript about once, a few times a minute at most.
 */
async function checkNewTurns({
  row,
  ...check
}: Parameters<typeof runObjectiveCheck>[0] & {
  row: Pick<LanguageConversation, "checkedTurns" | "id" | "minutes">;
}): Promise<ObjectiveCheck> {
  if (check.turns.length <= row.checkedTurns) {
    return NOTHING_FOUND;
  }

  const { count } = await prisma.languageConversation.updateMany({
    data: { checkedTurns: check.turns.length, objectiveChecks: { increment: 1 } },
    where: {
      checkedTurns: row.checkedTurns,
      id: row.id,
      objectiveChecks: { lt: row.minutes * CHECKS_PER_CALL_MINUTE },
    },
  });

  if (count === 0) {
    return NOTHING_FOUND;
  }

  const turns = check.turns.slice(Math.max(0, row.checkedTurns - CONTEXT_TURNS));
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

  if (!scenario || !row.startedAt) {
    return { status: "invalid" };
  }

  if (Date.now() > row.startedAt.getTime() + row.minutes * MS_PER_MINUTE + LATE_CHECK_MS) {
    return { status: "conversationEnded" };
  }

  await prisma.liveCallConnection.updateMany({
    data: { lastActiveAt: new Date() },
    where: { conversationId: row.id, state: "live", userId },
  });

  const found = scenario.examTask
    ? NOTHING_FOUND
    : await checkNewTurns({ row, scenario, turns: input.turns, userId });

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
