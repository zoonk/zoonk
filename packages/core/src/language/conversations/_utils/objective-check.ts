import "server-only";
import { checkConversationObjectives } from "@zoonk/ai/tasks/v2/language/conversation-objectives";
import { type LanguageConversation } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { type ConversationTurn } from "../conversation-contract";
import { type SavedScenario } from "./conversation-view";

/**
 * The objectives a call's transcript shows the learner has now achieved, among those not met yet.
 * A separate text model reads it, since GPT-Live has no tools on AI Gateway. A failed model call
 * finds none: the next check reads the same turns again.
 */
export async function findNewlyMetObjectives({
  row,
  scenario,
  turns,
  userId,
}: {
  row: Pick<LanguageConversation, "goalId" | "language" | "objectivesMet" | "targetLanguage">;
  scenario: SavedScenario;
  turns: ConversationTurn[];
  userId: string;
}): Promise<string[]> {
  const open = scenario.objectives.filter(
    (objective) => !row.objectivesMet.includes(objective.label),
  );

  if (open.length === 0 || !turns.some((turn) => turn.speaker === "learner")) {
    return [];
  }

  try {
    const { data } = await checkConversationObjectives({
      analytics: {
        contentScope: "personal",
        distinctId: userId,
        ...(row.goalId ? { goalId: row.goalId } : {}),
      },
      characterNotes: scenario.characterBrief,
      learnerLanguage: row.language,
      objectives: open,
      situation: scenario.situation,
      targetLanguage: row.targetLanguage,
      turns,
    });

    return [...new Set(data.met.map((objective) => objective.label))];
  } catch (error) {
    logError("Checking a call's objectives failed", error);
    return [];
  }
}
