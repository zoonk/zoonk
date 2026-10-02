type LayeredSkill = { prerequisiteIds: readonly string[]; skillId: string };

export type SkillMapEdge = { from: string; to: string };

/**
 * Rows for a map drawn top to bottom: each skill sits one row below the deepest skill it needs on
 * the same map, so every link points down, whatever order the skills come in. Links to skills
 * outside the map don't move a skill, and a loop in the graph is cut where it closes.
 */
export function toSkillMapLayers<TSkill extends LayeredSkill>(
  skills: readonly TSkill[],
): TSkill[][] {
  const byId = new Map(skills.map((skill) => [skill.skillId, skill]));
  const depths = new Map<string, number>();

  function depthOf(skillId: string, path: ReadonlySet<string>): number {
    const known = depths.get(skillId);

    if (known !== undefined) {
      return known;
    }

    const needs = (byId.get(skillId)?.prerequisiteIds ?? []).filter(
      (id) => byId.has(id) && !path.has(id) && id !== skillId,
    );

    const along = new Set([...path, skillId]);
    const depth = needs.length === 0 ? 0 : Math.max(...needs.map((id) => depthOf(id, along))) + 1;

    depths.set(skillId, depth);
    return depth;
  }

  const rows = skills.map((skill) => depthOf(skill.skillId, new Set()));
  const rowCount = Math.max(-1, ...rows) + 1;

  return Array.from({ length: rowCount }, (_, row) =>
    skills.filter((_skill, index) => rows[index] === row),
  );
}

/**
 * The lines to draw: from the map's root to each skill that needs nothing on the map, and from
 * each prerequisite to the skill that builds on it.
 */
export function toSkillMapEdges({
  rootId,
  skills,
}: {
  rootId: string;
  skills: readonly LayeredSkill[];
}): SkillMapEdge[] {
  const onMap = new Set(skills.map((skill) => skill.skillId));

  return skills.flatMap((skill) => {
    const needs = skill.prerequisiteIds.filter((id) => onMap.has(id) && id !== skill.skillId);

    return needs.length === 0
      ? [{ from: rootId, to: skill.skillId }]
      : needs.map((id) => ({ from: id, to: skill.skillId }));
  });
}
