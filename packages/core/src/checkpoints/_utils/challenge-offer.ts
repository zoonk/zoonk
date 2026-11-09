import "server-only";
import { toListeningExam } from "../../exams/listening/listening-exam";
import { getListeningSkillIds } from "../../exams/listening/listening-skills";
import {
  type SavedItemFacts,
  readSelectedItemFacts,
} from "../../plans/_utils/selected-item-contract";
import { parsePlanGraph, parsePlanPhases } from "../../plans/planner/plan-state";
import { getSkippedSkillIds } from "../../sessions/_utils/review-skills";
import { getBossQuestionSkills } from "../checkpoint-minutes";
import { getBossSkillIds } from "../checkpoint-rules";
import { isChallengeReached } from "./challenge-reach";
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

function getPreviewSkillIds(challenge: OwnedChallenge): string[] {
  const preview =
    challenge.item.kind === "boss" &&
    challenge.item.status === "todo" &&
    !isChallengeReached({ boss: challenge.item, items: challenge.items });

  if (!preview) {
    const offer = readBossOffer(challenge);
    return offer && !offer.waiting ? offer.testedSkillIds : [];
  }

  const graph = parsePlanGraph(challenge.plan.graph);
  const skipped = getSkippedSkillIds({ graph, settings: challenge.plan.settings });

  const itemSkillIds = new Map(
    challenge.items.map((item) => [
      item.id,
      readSelectedItemFacts(item.facts)?.skillIds ?? (item.skillId ? [item.skillId] : []),
    ]),
  );

  return getBossSkillIds({
    boss: challenge.item,
    graphSkills: graph.skills,
    itemSkillIds,
    items: challenge.items,
    phases: parsePlanPhases(challenge.plan.phases),
    skills: [...new Set([...itemSkillIds.values()].flat())]
      .filter((id) => !skipped.has(id))
      .map((id) => ({ id })),
    targetDate: challenge.goal.targetDate,
  });
}

export function getOfferSkillIds(challenge: OwnedChallenge): string[] {
  return getBossQuestionSkills({
    listeningSkillIds: getListeningSkillIds({
      exam: toListeningExam(challenge.goal),
      graph: parsePlanGraph(challenge.plan.graph),
    }),
    skillIds: getPreviewSkillIds(challenge),
  }).skillIds;
}
