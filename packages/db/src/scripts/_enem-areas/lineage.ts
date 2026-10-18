import { type Skill, type SkillPrerequisite } from "../../generated/prisma/client";
import { type SeedLanguage } from "../../prisma/seed/v2/_utils/localize";
import { ENEM_AREAS } from "../../prisma/seed/v2/library/enem/enem-chapters";

export type AreaSource = { area: string; skillId: string };

/** Unrelated Library publication must not invalidate a review; every connected source must. */
export function getLineageFingerprintSources({
  edges,
  skillIds,
  skills,
}: {
  edges: readonly Pick<SkillPrerequisite, "prerequisiteId" | "skillId">[];
  skillIds: readonly string[];
  skills: readonly Pick<Skill, "id" | "identityKey" | "mergedIntoId">[];
}) {
  function collect(ids: ReadonlySet<string>): ReadonlySet<string> {
    const joined = new Set([
      ...ids,
      ...skills.flatMap((skill) => (ids.has(skill.id) ? (skill.mergedIntoId ?? []) : [])),
      ...skills
        .filter((skill) => skill.mergedIntoId !== null && ids.has(skill.mergedIntoId))
        .map((skill) => skill.id),
      ...edges.flatMap((edge) =>
        ids.has(edge.skillId) || ids.has(edge.prerequisiteId)
          ? [edge.skillId, edge.prerequisiteId]
          : [],
      ),
    ]);

    return joined.size === ids.size ? joined : collect(joined);
  }

  const connected = collect(new Set(skillIds));

  return {
    edges: edges.filter((edge) => connected.has(edge.skillId)),
    skills: skills.filter((skill) => connected.has(skill.id)),
  };
}

export function normalizeEnemArea({
  area,
  language,
}: {
  area: string;
  language: SeedLanguage;
}): string {
  const aliases = new Map([
    ["Ciências da Natureza e suas Tecnologias", ENEM_AREAS.sciences.in(language)],
    ["Matemática e suas Tecnologias", ENEM_AREAS.math.in(language)],
    ["Linguagens, Códigos e suas Tecnologias", ENEM_AREAS.languages.in(language)],
    ["Ciências Humanas e suas Tecnologias", ENEM_AREAS.humanities.in(language)],
  ]);

  return aliases.get(area) ?? area;
}

/** Only public seed identity, stored public graph and public prerequisite lineage classify tags. */
export function createAreaLineage({
  edges,
  language,
  skills,
  sources,
}: {
  edges: readonly Pick<SkillPrerequisite, "prerequisiteId" | "skillId">[];
  language: SeedLanguage;
  skills: readonly Pick<Skill, "id" | "mergedIntoId">[];
  sources: readonly AreaSource[];
}) {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));

  function canonical(id: string, path: readonly string[] = []): string {
    if (path.includes(id)) {
      throw new Error("Skill merge cycle; refusing area backfill");
    }

    const next = byId.get(id)?.mergedIntoId;
    return next ? canonical(next, [...path, id]) : id;
  }

  const known = new Map<string, Set<string>>();

  for (const source of sources) {
    const id = canonical(source.skillId);
    const values = known.get(id) ?? new Set<string>();
    values.add(normalizeEnemArea({ area: source.area, language }));
    known.set(id, values);
  }

  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();

  for (const edge of edges) {
    const id = canonical(edge.skillId);
    const parent = canonical(edge.prerequisiteId);

    if (id !== parent) {
      parents.set(id, [...(parents.get(id) ?? []), parent]);
      children.set(parent, [...(children.get(parent) ?? []), id]);
    }
  }

  function descendantAreas(id: string, path: readonly string[] = []): string[] {
    if (path.includes(id)) {
      return [];
    }

    const direct = [...(known.get(id) ?? [])];

    return direct.length > 0
      ? direct
      : [
          ...new Set(
            (children.get(id) ?? []).flatMap((child) => descendantAreas(child, [...path, id])),
          ),
        ];
  }

  function areasOf(id: string, path: readonly string[] = []): { areas: string[]; source: string } {
    const key = canonical(id);

    if (path.includes(key)) {
      return { areas: [], source: "prerequisite cycle" };
    }

    const direct = [...(known.get(key) ?? [])];

    if (direct.length > 0) {
      return { areas: direct.toSorted(), source: "seed identity/public graph" };
    }

    const ancestors = (parents.get(key) ?? []).map((parent) => areasOf(parent, [...path, key]));
    const inherited = [...new Set(ancestors.flatMap((ancestor) => ancestor.areas))];

    return inherited.length > 0
      ? { areas: inherited.toSorted(), source: "prerequisite ancestry" }
      : { areas: descendantAreas(key).toSorted(), source: "prerequisite descendants" };
  }

  return {
    evidence: (skillId: string) => ({
      canonicalId: canonical(skillId),
      skillId,
      ...areasOf(skillId),
    }),
  };
}
