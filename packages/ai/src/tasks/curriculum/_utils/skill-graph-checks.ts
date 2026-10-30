import { normalizeString } from "@zoonk/utils/string";
import { findWritingFlaws } from "@zoonk/utils/text-flaws";

export type CheckedGraphSkill = {
  area: string;
  description: string;
  key: string;
  name: string;
  phase: number;
  prerequisites: readonly string[];
  /** Empty outside exams and beyond their notice. */
  topics: readonly string[];
};

type SkillGraphProblemCode =
  | "cycle"
  | "deepChain"
  | "emDash"
  | "markdown"
  | "nearDuplicate"
  | "offNoticeFirst"
  | "placeholder"
  | "repeatedPhaseName"
  | "textbookChain";

/**
 * `keys` let a graph written in sections write again only the sections that hold them; a problem
 * in the phases has none.
 */
export type SkillGraphProblem = { code: SkillGraphProblemCode; keys: string[]; problem: string };

/** A physics path from zero builds about ten deep; deeper means invented dependencies. */
const MAX_CHAIN = 12;

/**
 * A subject chained through more of its skills follows a textbook's order instead of hard
 * dependencies, and a plan short on time pays for every link.
 */
const MAX_CHAINED_SHARE = 0.75;
const MIN_CHAINED_SUBJECT = 6;

const NAME_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "au",
  "aux",
  "da",
  "das",
  "de",
  "del",
  "der",
  "des",
  "die",
  "do",
  "dos",
  "du",
  "e",
  "el",
  "em",
  "en",
  "et",
  "for",
  "im",
  "in",
  "la",
  "las",
  "le",
  "les",
  "los",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "of",
  "on",
  "os",
  "the",
  "to",
  "um",
  "uma",
  "und",
  "von",
  "with",
  "y",
]);

export function toNameWords(name: string): string[] {
  return normalizeString(name)
    .replaceAll(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/u)
    .filter((word) => word && !NAME_STOPWORDS.has(word));
}

/**
 * Words in any order: "Calcular os juros compostos" and "Calcular juros compostos" are one skill.
 */
export function toSkillNameKey(name: string): string {
  return [...new Set(toNameWords(name))].toSorted().join(" ");
}

type Graph = ReadonlyMap<string, CheckedGraphSkill>;

function findCycles(graph: Graph): SkillGraphProblem[] {
  const state = new Map<string, "visiting" | "done">();

  const visit = (key: string, path: readonly string[]): SkillGraphProblem[] => {
    state.set(key, "visiting");

    const found = (graph.get(key)?.prerequisites ?? []).flatMap((prerequisite) => {
      if (state.get(prerequisite) === "visiting") {
        const loop = [...path.slice(path.indexOf(prerequisite)), key, prerequisite];
        const names = loop.map((step) => graph.get(step)?.name ?? step);

        return [
          {
            code: "cycle" as const,
            keys: [...new Set(loop)],
            problem: `Prerequisites loop: ${names.join(" → ")}.`,
          },
        ];
      }

      return graph.has(prerequisite) && !state.has(prerequisite)
        ? visit(prerequisite, [...path, key])
        : [];
    });

    state.set(key, "done");
    return found;
  };

  return [...graph.keys()].flatMap((key) => (state.has(key) ? [] : visit(key, [])));
}

/** An edge that closes a cycle is skipped, so cycles are only reported once. */
function measureChains({
  follows,
  graph,
}: {
  follows: (skill: CheckedGraphSkill, prerequisite: CheckedGraphSkill) => boolean;
  graph: Graph;
}): Map<string, number> {
  const depths = new Map<string, number>();
  const visiting = new Set<string>();

  const depth = (key: string): number => {
    const known = depths.get(key);
    const skill = graph.get(key);

    if (known !== undefined || !skill || visiting.has(key)) {
      return known ?? 0;
    }

    visiting.add(key);

    const deepest = skill.prerequisites.flatMap((prerequisite) => {
      const required = graph.get(prerequisite);
      return required && follows(skill, required) ? [depth(prerequisite)] : [];
    });

    visiting.delete(key);
    depths.set(key, 1 + Math.max(0, ...deepest));

    return depths.get(key) ?? 1;
  };

  [...graph.keys()].forEach((key) => depth(key));

  return depths;
}

function traceChain({
  depths,
  graph,
  key,
}: {
  depths: ReadonlyMap<string, number>;
  graph: Graph;
  key: string;
}): string[] {
  const depth = depths.get(key) ?? 1;

  const deeper = (graph.get(key)?.prerequisites ?? []).find(
    (prerequisite) => depths.get(prerequisite) === depth - 1,
  );

  return deeper && depth > 1 ? [key, ...traceChain({ depths, graph, key: deeper })] : [key];
}

function findDeepChains(graph: Graph): SkillGraphProblem[] {
  const depths = measureChains({ follows: () => true, graph });
  const [deepest] = [...depths.entries()].toSorted((first, second) => second[1] - first[1]);

  return deepest && deepest[1] > MAX_CHAIN
    ? [
        {
          code: "deepChain",
          keys: traceChain({ depths, graph, key: deepest[0] }),
          problem: `"${graph.get(deepest[0])?.name}" sits at the end of a chain of ${deepest[1]} prerequisites; list only what a skill can't be learned without (at most ${MAX_CHAIN} deep).`,
        },
      ]
    : [];
}

function findTextbookChains(graph: Graph): SkillGraphProblem[] {
  const depths = measureChains({
    follows: (skill, prerequisite) => skill.area === prerequisite.area,
    graph,
  });

  return [...Map.groupBy(graph.values(), (skill) => skill.area).entries()].flatMap(
    ([area, skills]) => {
      const longest = Math.max(...skills.map((skill) => depths.get(skill.key) ?? 1));

      return skills.length >= MIN_CHAINED_SUBJECT && longest / skills.length > MAX_CHAINED_SHARE
        ? [
            {
              code: "textbookChain" as const,
              keys: skills.map((skill) => skill.key),
              problem: `${area}: ${longest} of its ${skills.length} skills form one prerequisite chain, a textbook's order; a skill needs another only when its lessons can't be followed without it.`,
            },
          ]
        : [];
    },
  );
}

/**
 * The plan would teach what the exam doesn't ask before what it does (the Câmara's IT opened on 26
 * lessons of records formats, Oct 2026).
 */
function findOffNoticeFirst(skills: readonly CheckedGraphSkill[]): SkillGraphProblem[] {
  return [...Map.groupBy(skills, (skill) => skill.area).entries()].flatMap(([area, inArea]) => {
    const [first] = inArea;
    const hasNotice = inArea.some((skill) => skill.topics.length > 0);

    return first && hasNotice && first.topics.length === 0
      ? [
          {
            code: "offNoticeFirst" as const,
            keys: [first.key],
            problem: `${area} opens on "${first.name}", which teaches none of the notice's topics; its notice topics come first.`,
          },
        ]
      : [];
  });
}

function findNearDuplicates(skills: readonly CheckedGraphSkill[]): SkillGraphProblem[] {
  const groups = Map.groupBy(skills, (skill) => toSkillNameKey(skill.name));

  return [...groups.values()].flatMap((group) =>
    group.length > 1
      ? [
          {
            code: "nearDuplicate" as const,
            keys: group.map((skill) => skill.key),
            problem: `${group.map((skill) => `"${skill.name}"`).join(" and ")} are one skill written twice; keep one.`,
          },
        ]
      : [],
  );
}

type GraphPhase = { milestone: string; title: string };

/**
 * The learner sees what a phase teaches under its title, so a title naming a skill or an area
 * shows the same name twice.
 */
function findRepeatedPhaseNames({
  phases,
  skills,
}: {
  phases: readonly GraphPhase[];
  skills: readonly CheckedGraphSkill[];
}): SkillGraphProblem[] {
  const taught = new Map([
    ...skills.map((skill) => [toSkillNameKey(skill.area), `the area "${skill.area}"`] as const),
    ...skills.map((skill) => [toSkillNameKey(skill.name), `the skill "${skill.name}"`] as const),
  ]);

  return phases.flatMap((phase, index) => {
    const key = toSkillNameKey(phase.title);
    const earlier = phases.findIndex((other) => toSkillNameKey(other.title) === key);
    const repeated = earlier < index ? `phase ${earlier + 1}` : taught.get(key);

    return key && repeated
      ? [
          {
            code: "repeatedPhaseName" as const,
            keys: [],
            problem: `Phase ${index + 1} is titled "${phase.title}", like ${repeated}; title the stage of the path, not something it teaches.`,
          },
        ]
      : [];
  });
}

function findWritingProblems({
  phases,
  skills,
}: {
  phases: readonly GraphPhase[];
  skills: readonly CheckedGraphSkill[];
}): SkillGraphProblem[] {
  const texts = [
    ...skills.flatMap((skill) => [
      { keys: [skill.key], text: skill.name },
      { keys: [skill.key], text: skill.description },
    ]),
    ...phases.flatMap((phase) => [
      { keys: [], text: phase.title },
      { keys: [], text: phase.milestone },
    ]),
  ];

  return texts.flatMap(({ keys, text }) =>
    findWritingFlaws({ layout: "inline", text }).map(({ kind, problem }) => ({
      code: kind,
      keys,
      problem,
    })),
  );
}

/** `exam` is whether the graph follows an exam's notice. */
export function findSkillGraphProblems({
  exam,
  phases,
  skills,
}: {
  exam: boolean;
  phases: readonly GraphPhase[];
  skills: readonly CheckedGraphSkill[];
}): SkillGraphProblem[] {
  const graph: Graph = new Map(skills.map((skill) => [skill.key, skill]));

  return [
    ...findCycles(graph),
    ...findDeepChains(graph),
    ...(exam ? findTextbookChains(graph) : []),
    ...(exam ? findOffNoticeFirst(skills) : []),
    ...findNearDuplicates(skills),
    ...findRepeatedPhaseNames({ phases, skills }),
    ...findWritingProblems({ phases, skills }),
  ];
}
