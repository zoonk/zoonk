import "server-only";
import { type BossBankFacts } from "../checkpoint-minutes";
import { CHECKPOINT_QUESTIONS } from "../checkpoint-rules";
import { listRecordingSets } from "./boss-recordings";
import { listCheckpointQuestions } from "./checkpoint-candidates";

/**
 * What the question bank holds for a goal's bosses (see `BossBankFacts`), with the same reads the
 * session's boss makes: each text skill's questions a duel can ask, and the voiced recordings on
 * the listening skills in the order the learner (`userId`) hears them next. No learner (a public
 * estimate's) reads no answers: the recordings come in the order they were written.
 */
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
    // A boss asks ten at most: more on a skill changes nothing it asks.
    textCounts: new Map(
      [...bySkill].map(([skillId, list]) => [skillId, Math.min(CHECKPOINT_QUESTIONS, list.length)]),
    ),
  };
}
