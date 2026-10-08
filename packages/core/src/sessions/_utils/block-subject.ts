/**
 * The one subject a block studies: its plan item's skill's when it has one (a lesson's own skills
 * are finer than the plan's), else the one subject all its skills share. Skills outside the goal's
 * graph don't count; mixed subjects, or none, give null.
 */
export function getBlockSubject({
  planItemSkillId,
  skillIds,
  skillSubjects,
}: {
  planItemSkillId?: string | null;
  skillIds: readonly string[];
  skillSubjects: ReadonlyMap<string, string>;
}): string | null {
  const planned = planItemSkillId ? skillSubjects.get(planItemSkillId) : undefined;

  if (planned) {
    return planned;
  }

  const subjects = new Set(skillIds.flatMap((skillId) => skillSubjects.get(skillId) ?? []));
  const [subject] = subjects;

  return subjects.size === 1 ? (subject ?? null) : null;
}
