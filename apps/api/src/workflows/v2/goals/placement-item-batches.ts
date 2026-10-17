import { type PlacementItemPick } from "@zoonk/core/lookahead/placement-item-skills";
import { splitEvenly } from "@zoonk/utils/split-evenly";

/**
 * Quick questions one model call writes, with their skills' typed ones. Every call repeats the
 * same instructions (about 3,000 input tokens), so fewer calls cost less; but output comes token
 * by token, and the learner's first question can wait on the first call of the first saved slice.
 * Output costs most and grows with the skills, not the calls: three skills per call wrote about
 * 2,900 output tokens (1,100 of them reasoning), some 20–28 s at the priority tier (the standard
 * tier is about half as fast; only an exam's or a language's first call gets priority), where one
 * skill's three multiple-choice questions used to take 12–20 s. Two skills per call keep that wait
 * short for about $0.02 more per goal, and a slice's calls run at once.
 */
const QUICK_ITEMS_PER_CALL = 2;

/**
 * Placement's picked skills in the batches one model call writes, in pick order: skills that need
 * the same questions (a typed one too, or only quick ones) and whose content has the same owner
 * (a private course's or shared), as many per call as `quickCount` quick questions each allow.
 * The first pick is the first question placement asks, so it gets the shortest call, of its own:
 * in a cold INSS goal its two-skill call landed last of eight, and the learner waited on it.
 */
export function toPlacementItemBatches<
  TSkill extends Pick<PlacementItemPick, "needsTyped" | "ownerId">,
>({ quickCount, skills }: { quickCount: number; skills: readonly TSkill[] }): TSkill[][] {
  const [first, ...rest] = skills;

  if (!first) {
    return [];
  }

  const size = Math.max(1, Math.floor(QUICK_ITEMS_PER_CALL / quickCount));
  const groups = Map.groupBy(rest, (skill) => JSON.stringify([skill.ownerId, skill.needsTyped]));

  return [[first], ...[...groups.values()].flatMap((items) => splitEvenly({ items, size }))];
}
