import "server-only";
import { checkConversationObjectives } from "@zoonk/ai/tasks/language/conversation-objectives";
import { type LanguageConversation } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { type ConversationTurn } from "../conversation-contract";
import { type SavedScenario } from "./conversation-view";

export type ObjectiveCheck = { goodbye: boolean; met: string[] };

export const NOTHING_FOUND: ObjectiveCheck = { goodbye: false, met: [] };

/**
 * `met` holds the newly met labels. A model failure leaves objectives unmet and the call going;
 * the call's review reads the whole transcript again.
 */
export async function runObjectiveCheck({
  row,
  scenario,
  turns,
  userId,
}: {
  row: Pick<LanguageConversation, "goalId" | "language" | "objectivesMet" | "targetLanguage">;
  scenario: SavedScenario;
  turns: ConversationTurn[];
  userId: string;
}): Promise<ObjectiveCheck> {
  const open = scenario.objectives.filter(
    (objective) => !row.objectivesMet.includes(objective.label),
  );

  if (open.length === 0 || !turns.some((turn) => turn.speaker === "learner")) {
    return NOTHING_FOUND;
  }

  try {
    const { data } = await checkConversationObjectives({
      analytics: {
        contentScope: "personal",
        distinctId: userId,
        ...(row.goalId ? { goalId: row.goalId } : {}),
      },
      characterNotes: scenario.characterBrief,
      exam: scenario.exam,
      learnerLanguage: row.language,
      objectives: open,
      situation: scenario.situation,
      targetLanguage: row.targetLanguage,
      turns,
    });

    return {
      goodbye: data.goodbye,
      met: [...new Set(data.met.map((objective) => objective.label))],
    };
  } catch (error) {
    logError("Checking a call's objectives failed", error);
    return NOTHING_FOUND;
  }
}
