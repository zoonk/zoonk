type SituationSkill = { name: string; usedSituations?: readonly string[] | null };

export function formatUsedSituations({
  indent,
  situations,
}: {
  indent: string;
  situations: readonly string[] | null | undefined;
}): string {
  if (!situations?.length) {
    return "";
  }

  const lines = situations.map((situation) => `\n${indent}  - ${situation}`);
  return `\n${indent}USED_SITUATIONS:${lines.join("")}`;
}

/**
 * The cast follows the skill's existing questions, so the next batch for a skill draws its own cast
 * instead of the batch before it's names in the same order.
 */
export function getSituationSeed(skills: readonly SituationSkill[]): string {
  return skills.flatMap((skill) => [skill.name, ...(skill.usedSituations ?? [])]).join(":");
}
