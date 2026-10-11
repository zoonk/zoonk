function getSubjects(
  skillIds: readonly string[],
  skillSubjects: ReadonlyMap<string, string>,
): Set<string> {
  return new Set(skillIds.flatMap((skillId) => skillSubjects.get(skillId) ?? []));
}

/**
 * The one subject a block studies: the one all its own skills share, else its plan item's skill's
 * (a lesson's own skills can be finer than the graph's), unless the lesson's chapter is tagged with
 * skills of several subjects, where the plan item's is a guess. Skills outside the goal's graph
 * don't count; nothing settled gives null.
 */
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
