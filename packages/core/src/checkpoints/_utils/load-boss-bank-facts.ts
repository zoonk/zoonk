import "server-only";
import { type BossBankFacts } from "../checkpoint-minutes";
import { CHECKPOINT_QUESTIONS } from "../checkpoint-rules";
import { listRecordingSets } from "./boss-recordings";
import { listCheckpointQuestions } from "./checkpoint-candidates";

/** A null userId reads no answers and orders recordings by creation. */
export async function loadBossBankFacts({
  examBlueprintId,
  listeningSkillIds,
  skillIds,
  userId,
}: {
  examBlueprintId: string | null;
  listeningSkillIds: ReadonlySet<string>;
  skillIds: readonly string[];
  userId: string | null;
}): Promise<BossBankFacts> {
  const textSkillIds = skillIds.filter((skillId) => !listeningSkillIds.has(skillId));
  const recordingSkillIds = skillIds.filter((skillId) => listeningSkillIds.has(skillId));

  const [questions, recordingSets] = await Promise.all([
    textSkillIds.length > 0
      ? listCheckpointQuestions({
          examBlueprintId,
          publicOnly: userId === null,
          skillIds: textSkillIds,
        })
      : [],
    recordingSkillIds.length > 0
      ? listRecordingSets({ examBlueprintId, skillIds: recordingSkillIds, userId })
      : [],
  ]);

  const bySkill = Map.groupBy(questions, (question) => question.skillId);

  return {
    recordingSets,
    textCounts: new Map(
      [...bySkill].map(([skillId, list]) => [skillId, Math.min(CHECKPOINT_QUESTIONS, list.length)]),
    ),
  };
}
