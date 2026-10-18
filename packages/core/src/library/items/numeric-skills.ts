import "server-only";
import { type Skill, prisma } from "@zoonk/db";

/**
 * Whether a skill can be asked with a number typed in: every skill until the item writer, asked
 * for such questions, found none (`Skill.isQuantitative`), since a reading or history skill has no
 * problem whose answer is one number it works out.
 */
export function takesNumericAnswers(skill: Pick<Skill, "isQuantitative">): boolean {
  return skill.isQuantitative !== false;
}

/**
 * Keeps what a numeric write tells about its skill: none written means the writer found no problem
 * with one number for its answer, so it isn't asked again; a stored question means it takes them.
 * Questions written but all failing their checks say nothing.
 *
 * This is a workflow bridge: the skill id comes from a pick the public boundary started.
 */
export async function recordNumericWrite({
  created,
  generated,
  skillId,
}: {
  created: number;
  generated: number;
  skillId: string;
}): Promise<void> {
  if (generated > 0 && created === 0) {
    return;
  }

  await prisma.skill.update({ data: { isQuantitative: created > 0 }, where: { id: skillId } });
}
