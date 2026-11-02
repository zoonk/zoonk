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

export function readBossOffer(challenge: {
  item: Pick<OwnedChallenge["item"], "facts" | "kind">;
}): BossFacts | null {
  const { item } = challenge;

  return item.kind === "boss" || item.kind === "checkpoint"
    ? (readSelectedItemFacts(item.facts)?.boss ?? null)
    : null;
}

/** Zero means unavailable; null means the saved offer cannot promise a question count. */
export function getOfferQuestions(offer: BossFacts | null): number | null {
  if (offer?.waiting) {
    return 0;
  }

  return offer?.questions ?? null;
}

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
