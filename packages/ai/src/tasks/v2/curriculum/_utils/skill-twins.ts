import {
  type SkillGraph,
  normalizeCourses,
  normalizePhases,
  toHours,
} from "./normalize-skill-graph";
import {
  pushPhasesAfterPrerequisites,
  removeCycles,
  sortSkillsTopologically,
} from "./order-skill-graph";
import { toNameWords } from "./skill-graph-checks";

/**
 * Letters of a word compared, so a word's plural or other ending reads the same ("chart" and
 * "charts", "analysis" and "analyses").
 */
const STEM_LENGTH = 5;

/** Short words that never say what a skill acts on, beyond the articles names never count. */
const LINKING_WORDS = new Set([
  "ao",
  "aos",
  "com",
  "entre",
  "how",
  "para",
  "pela",
  "pelas",
  "pelo",
  "pelos",
  "por",
  "sem",
  "sobre",
  "what",
  "why",
  "your",
]);

type NamedSkill = { area: string; key: string; name: string };

/** What a skill's name acts on: its words after the action that opens it, as stems. */
function toObjectStems(name: string): Set<string> {
  const [, ...object] = toNameWords(name).filter((word) => !LINKING_WORDS.has(word));
  return new Set(object.map((word) => word.slice(0, STEM_LENGTH)));
}

/** Whether two names act on the same thing: half or more of the shorter one's object is shared. */
function sharesObject(first: ReadonlySet<string>, second: ReadonlySet<string>): boolean {
  const shared = [...first].filter((stem) => second.has(stem)).length;
  return shared > 0 && shared * 2 >= Math.min(first.size, second.size);
}

/**
 * For each skill, the earlier skills of its area that may be it in other words ("Read and compare
 * data in charts and tables" and "Interpret charts and tables"), which one reuse decision
 * judges: only names that act on the same thing are asked about, so an ENEM graph of 135 skills
 * asks about 46 of them. A skill with none isn't listed.
 */
export function findTwinCandidates<TSkill extends NamedSkill>(
  skills: readonly TSkill[],
): { siblings: TSkill[]; skill: TSkill }[] {
  const stems = new Map(skills.map((skill) => [skill.key, toObjectStems(skill.name)]));
  const stemsOf = (skill: TSkill) => stems.get(skill.key) ?? new Set<string>();

  return skills.flatMap((skill, index) => {
    const siblings = skills
      .slice(0, index)
      .filter((other) => other.area === skill.area && sharesObject(stemsOf(skill), stemsOf(other)));

    return siblings.length > 0 ? [{ siblings, skill }] : [];
  });
}

/** The skill a twin's key ends at, following twins of twins. */
function findSurvivor({ key, twins }: { key: string; twins: ReadonlyMap<string, string> }): string {
  const next = twins.get(key);
  return next && next !== key ? findSurvivor({ key: next, twins }) : key;
}

type GraphSkill = SkillGraph["skills"][number];

/** Whether `key` needs `target` before it, through its prerequisites and theirs. */
function needs({
  byKey,
  key,
  seen = new Set(),
  target,
}: {
  byKey: ReadonlyMap<string, GraphSkill>;
  key: string;
  seen?: Set<string>;
  target: string;
}): boolean {
  if (key === target) {
    return true;
  }

  seen.add(key);

  return (byKey.get(key)?.prerequisites ?? []).some(
    (prerequisite) => !seen.has(prerequisite) && needs({ byKey, key: prerequisite, seen, target }),
  );
}

/**
 * Each skill with its own edges, an edge to a twin pointing to the skill it repeats; a twin's
 * edges are what each surviving skill may take from its twins.
 */
function redirectEdges({
  graph,
  twins,
}: {
  graph: SkillGraph;
  twins: ReadonlyMap<string, string>;
}) {
  const survivorOf = (key: string) => findSurvivor({ key, twins });
  const survivors = graph.skills.filter((skill) => survivorOf(skill.key) === skill.key);

  return survivors.map((skill) => {
    const own = skill.prerequisites.map(survivorOf);
    const copies = graph.skills.filter((other) => survivorOf(other.key) === skill.key);
    const inherited = copies.flatMap((copy) => copy.prerequisites.map(survivorOf));

    return {
      inherited: [...new Set(inherited)].filter((key) => key !== skill.key && !own.includes(key)),
      skill: {
        ...skill,
        outcome: copies.some((copy) => copy.outcome),
        prerequisites: [...new Set(own)].filter((key) => key !== skill.key),
        topics: [...new Set(copies.flatMap((copy) => copy.topics))],
      },
    };
  });
}

/**
 * The graph with each twin merged into the skill it repeats (`twins` maps a twin's key to an
 * earlier skill's), the way `normalizeSkillGraph` merges a skill written twice: the earlier skill
 * keeps its place, name, size and edges, takes the twin's topics and outcome and the twin's
 * prerequisites that don't need it first, and every edge to the twin points to it. Phases, courses
 * and hours are counted again.
 */
export function mergeSkillTwins({
  graph,
  twins,
}: {
  graph: SkillGraph;
  twins: ReadonlyMap<string, string>;
}): SkillGraph {
  if (twins.size === 0) {
    return graph;
  }

  const redirected = redirectEdges({ graph, twins });
  const own = removeCycles(redirected.map(({ skill }) => skill));
  const byKey = new Map(own.map((skill) => [skill.key, skill]));

  const merged = own.map((skill, index) => ({
    ...skill,
    prerequisites: [
      ...skill.prerequisites,
      ...(redirected[index]?.inherited ?? []).filter(
        (key) => !needs({ byKey, key, target: skill.key }),
      ),
    ],
  }));

  const ordered = sortSkillsTopologically(pushPhasesAfterPrerequisites(removeCycles(merged)));
  const { phases, skills } = normalizePhases({ phases: graph.phases, skills: ordered });

  return {
    courses: normalizeCourses({ courses: graph.courses, skills }),
    estimatedHours: toHours(skills.reduce((total, skill) => total + skill.estimatedLessons, 0)),
    phases,
    skills,
  };
}
