function getSubjects(
  skillIds: readonly string[],
  skillSubjects: ReadonlyMap<string, string>,
): Set<string> {
  return new Set(skillIds.flatMap((skillId) => skillSubjects.get(skillId) ?? []));
}

/** Null when subjects conflict or cannot be established; ignore skills outside the goal graph. */
export function getBlockSubject({
  chapterSkillIds = [],
  planItemSkillId,
  skillIds,
  skillSubjects,
}: {
  chapterSkillIds?: readonly string[];
  planItemSkillId?: string | null;
  skillIds: readonly string[];
  skillSubjects: ReadonlyMap<string, string>;
}): string | null {
  const own = getSubjects(skillIds, skillSubjects);

  if (own.size === 1) {
    return [...own][0] ?? null;
  }

  const planned = planItemSkillId ? skillSubjects.get(planItemSkillId) : undefined;

  if (!planned || getSubjects(chapterSkillIds, skillSubjects).size > 1) {
    return null;
  }

  return planned;
}
