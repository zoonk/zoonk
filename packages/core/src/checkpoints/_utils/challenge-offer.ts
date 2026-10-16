import "server-only";
import { toListeningExam } from "../../exams/listening/listening-exam";
import { getListeningSkillIds } from "../../exams/listening/listening-skills";
import {
  type SavedItemFacts,
  readSelectedItemFacts,
} from "../../plans/_utils/selected-item-contract";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { getBossQuestionSkills } from "../checkpoint-minutes";
import { type OwnedChallenge } from "./owned-challenge";

type BossFacts = NonNullable<SavedItemFacts["boss"]>;

/**
 * A checkpoint before its block exists, as the plan's one build saved it on its item (see
 * `SelectedItemFacts.boss`). Null for any other challenge and for an item saved before its facts
 * were kept: that one offers only its title and Start, with no size or topics.
 */
export function readBossOffer(challenge: {
  item: Pick<OwnedChallenge["item"], "facts" | "kind">;
}): BossFacts | null {
  const { item } = challenge;

  return item.kind === "boss" || item.kind === "checkpoint"
    ? (readSelectedItemFacts(item.facts)?.boss ?? null)
    : null;
}

/**
 * The questions it asks before its block exists, when its saved facts say: none while it can't be
 * asked yet, else their count. Null when unknown (an item saved without facts, or a plan built
 * without its question bank): the intro then promises no size, only its title and Start.
 */
export function getOfferQuestions(offer: BossFacts | null): number | null {
  if (offer?.waiting) {
    return 0;
  }

  return offer?.questions ?? null;
}

/**
 * The skills its questions are on before its block exists, as its saved facts keep them. None
 * while it can't be asked yet or without saved facts, which promise no topics.
 */
export function getOfferSkillIds(challenge: OwnedChallenge): string[] {
  const offer = readBossOffer(challenge);

  if (!offer || offer.waiting) {
    return [];
  }

  return getBossQuestionSkills({
    listeningSkillIds: getListeningSkillIds({
      exam: toListeningExam(challenge.goal),
      graph: parsePlanGraph(challenge.plan.graph),
    }),
    skillIds: offer.testedSkillIds,
  }).skillIds;
}
