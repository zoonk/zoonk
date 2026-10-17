import "server-only";
import { prisma } from "@zoonk/db";
import { type BlockPayload, getBlockItemIds, readBlockPayload } from "../../sessions/block-payload";
import { loadSkillSubjects } from "../../view-models/syllabus/_utils/load-syllabus";
import { type ChallengeTopic } from "../challenge-contract";
import { getOfferSkillIds } from "./challenge-offer";
import { type ChallengeBlock, type OwnedChallenge, isLanguageCall } from "./owned-challenge";

/**
 * The skills of the questions a built block asks, in its skills' order; its skills while its
 * questions are still to be written.
 */
async function loadPayloadSkillIds(payload: BlockPayload): Promise<string[]> {
  const itemIds = getBlockItemIds(payload);

  if (itemIds.length === 0) {
    return payload.skillIds;
  }

  const items = await prisma.item.findMany({
    select: { skillId: true },
    where: { id: { in: itemIds } },
  });

  const asked = new Set(items.map((item) => item.skillId));
  return payload.skillIds.filter((skillId) => asked.has(skillId));
}

/**
 * The skills a duel asks: its questions', once the session built its block; before that, a phase
 * checkpoint's as its saved plan item keeps them (`readBossOffer`), which its questions will come
 * from. The week's challenge asks the week's skills from its block.
 */
async function loadAskedSkillIds({
  block,
  challenge,
}: {
  block: ChallengeBlock | null;
  challenge: OwnedChallenge;
}): Promise<string[]> {
  if (block) {
    return loadPayloadSkillIds(readBlockPayload(block));
  }

  return getOfferSkillIds(challenge);
}

/** The skills' names by id; a skill no longer in the Library has none. */
async function nameSkills(skillIds: readonly string[]): Promise<Map<string, string>> {
  const skills = await prisma.skill.findMany({
    select: { id: true, name: true },
    where: { id: { in: [...skillIds] } },
  });

  return new Map(skills.map((skill) => [skill.id, skill.name]));
}

/**
 * What a duel asks about (a phase's checkpoint, the week's challenge): the topics its questions
 * come from, in plan order, each with its subject's short name where the goal has several (see
 * `loadSkillSubjects`). A mock lists its sections instead, and a language goal's call asks none.
 */
export async function loadChallengeTopics({
  block,
  challenge,
}: {
  block: ChallengeBlock | null;
  challenge: OwnedChallenge;
}): Promise<ChallengeTopic[]> {
  if (challenge.item.kind === "mock" || isLanguageCall(challenge)) {
    return [];
  }

  const [skillIds, subjects] = await Promise.all([
    loadAskedSkillIds({ block, challenge }),
    loadSkillSubjects(challenge.goal),
  ]);

  const names = await nameSkills(skillIds);

  return skillIds.flatMap((skillId) => {
    const name = names.get(skillId);
    return name ? [{ name, subject: subjects.get(skillId) ?? null }] : [];
  });
}
