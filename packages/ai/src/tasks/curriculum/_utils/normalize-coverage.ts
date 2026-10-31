import { normalizeString } from "@zoonk/utils/string";
import { toPlainLine } from "@zoonk/utils/text-repairs";
import { type ExamOutline, placeInExam } from "../exam-outline";
import { toExamWeight } from "./exam-weight";
import { toSkillNameKey } from "./skill-graph-checks";

export type CoverageReference = { title: string; text: string };

type RawMissingSkill = {
  area: string;
  description: string;
  examWeight: number | null;
  name: string;
  prerequisites: string[];
  syllabusLine: string;
  topics: string[];
};

export type MissingSkill = {
  name: string;
  description: string;
  /** 1 to 5; null outside exams. */
  examWeight: number | null;
  prerequisites: string[];
  syllabusLine: string;
  reference: string;
  area: string | null;
  topics: string[];
};

export type SkillPlacement = { area: string; key: string; topics: string[] };

export type ExamWeightChange = { examWeight: number; key: string };

type GraphSkill = {
  area?: string | null;
  examWeight?: number | null;
  key: string;
  name: string;
  topics?: string[];
};

function comparable(text: string): string {
  return normalizeString(text)
    .replaceAll(/[^\p{L}\p{N} ]/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim();
}

function findReference({
  line,
  references,
}: {
  line: string;
  references: readonly { comparableText: string; title: string }[];
}): string | null {
  const quote = comparable(line);

  if (!quote) {
    return null;
  }

  return references.find((reference) => reference.comparableText.includes(quote))?.title ?? null;
}

function findSource({
  outline,
  references,
  skill,
}: {
  outline?: ExamOutline;
  references: readonly { comparableText: string; title: string }[];
  skill: RawMissingSkill;
}): { line: string; reference: string } | null {
  const reference = findReference({ line: skill.syllabusLine, references });

  if (reference) {
    return { line: skill.syllabusLine.trim(), reference };
  }

  if (!outline) {
    return null;
  }

  const [topic] = placeInExam({ area: skill.area, outline, topics: [skill.syllabusLine] }).topics;
  return topic ? { line: topic, reference: outline.name } : null;
}

function toPlace({ outline, skill }: { outline?: ExamOutline; skill: RawMissingSkill }) {
  if (!outline) {
    return { area: null, topics: [] };
  }

  return placeInExam({ area: skill.area, outline, topics: [...skill.topics, skill.syllabusLine] });
}

/**
 * A missing skill must quote a line found in a reference or, for an exam, one of its notice's
 * topics, so a quote the model made up is dropped.
 */
export function normalizeCoverage({
  exam,
  graphSkills,
  missing,
  outline,
  references,
}: {
  exam: boolean;
  graphSkills: readonly GraphSkill[];
  missing: readonly RawMissingSkill[];
  outline?: ExamOutline;
  references: readonly CoverageReference[];
}): MissingSkill[] {
  const graphKeys = new Set(graphSkills.map((skill) => skill.key));
  const graphNames = new Set(graphSkills.map((skill) => toSkillNameKey(skill.name)));

  const comparableReferences = references.map((reference) => ({
    comparableText: comparable(reference.text),
    title: reference.title,
  }));

  const found = missing.flatMap((skill) => {
    const source = findSource({ outline, references: comparableReferences, skill });
    const name = toPlainLine(skill.name);

    if (!source || !name || graphNames.has(toSkillNameKey(name))) {
      return [];
    }

    return [
      {
        ...toPlace({ outline, skill }),
        description: toPlainLine(skill.description),
        examWeight: exam ? toExamWeight(skill.examWeight) : null,
        name,
        prerequisites: [...new Set(skill.prerequisites)].filter((key) => graphKeys.has(key)),
        reference: source.reference,
        syllabusLine: source.line,
      },
    ];
  });

  const names = found.map((skill) => toSkillNameKey(skill.name));

  return found.filter((_, index) => names.indexOf(names[index] ?? "") === index);
}

export function normalizeExamWeights({
  changes,
  exam,
  graphSkills,
}: {
  changes: readonly ExamWeightChange[];
  exam: boolean;
  graphSkills: readonly GraphSkill[];
}): ExamWeightChange[] {
  if (!exam) {
    return [];
  }

  const current = new Map(graphSkills.map((skill) => [skill.key, skill.examWeight ?? null]));

  const valid = changes.flatMap((change) => {
    const examWeight = toExamWeight(change.examWeight);

    return current.has(change.key) && examWeight !== null && examWeight !== current.get(change.key)
      ? [{ examWeight, key: change.key }]
      : [];
  });

  return valid.filter(
    (change, index) => valid.findIndex((other) => other.key === change.key) === index,
  );
}

function isSamePlace({ placement, skill }: { placement: SkillPlacement; skill: GraphSkill }) {
  const topics = skill.topics ?? [];

  return (
    placement.area === skill.area &&
    placement.topics.length === topics.length &&
    placement.topics.every((topic) => topics.includes(topic))
  );
}

/**
 * A graph written before the notice was read can name a subject another way ("Professional
 * Ethics" for the OAB's), which showed it outside the plan on every screen that reads subjects.
 */
function placeNamedSkills({
  graphSkills,
  outline,
}: {
  graphSkills: readonly GraphSkill[];
  outline: ExamOutline;
}): SkillPlacement[] {
  const names = new Set(outline.subjects.map((subject) => subject.name));

  return graphSkills.flatMap((skill) => {
    if (!skill.area || names.has(skill.area)) {
      return [];
    }

    const placed = {
      key: skill.key,
      ...placeInExam({ area: skill.area, outline, topics: skill.topics ?? [] }),
    };

    return isSamePlace({ placement: placed, skill }) ? [] : [placed];
  });
}

export function normalizePlacements({
  graphSkills,
  outline,
  placements,
}: {
  graphSkills: readonly GraphSkill[];
  outline?: ExamOutline;
  placements: readonly SkillPlacement[];
}): SkillPlacement[] {
  if (!outline) {
    return [];
  }

  const skills = new Map(graphSkills.map((skill) => [skill.key, skill]));

  const valid = [
    ...placements.flatMap((placement) => {
      const skill = skills.get(placement.key);
      const placed = { key: placement.key, ...placeInExam({ ...placement, outline }) };

      return skill && !isSamePlace({ placement: placed, skill }) ? [placed] : [];
    }),
    ...placeNamedSkills({ graphSkills, outline }),
  ];

  return valid.filter(
    (item, index) => valid.findIndex((other) => other.key === item.key) === index,
  );
}
