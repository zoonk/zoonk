import "server-only";
import { type Skill, prisma } from "@zoonk/db";

export function takesNumericAnswers(skill: Pick<Skill, "isQuantitative">): boolean {
  return skill.isQuantitative !== false;
}

/** Internal workflow bridge: the skill must come from a pick the public boundary started. */
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
