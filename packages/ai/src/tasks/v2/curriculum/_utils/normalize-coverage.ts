import { normalizeString } from "@zoonk/utils/string";
import { type ExamOutline, placeInExam } from "../exam-outline";
import { toExamWeight } from "./exam-weight";

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
  /** How much of the exam depends on it, from 1 to 5; null outside exams. */
  examWeight: number | null;
  /** Keys of skills already in the graph that come right before it. */
  prerequisites: string[];
  /** The syllabus line it comes from, quoted from the reference. */
  syllabusLine: string;
  /** Title of the reference that contains the line. */
  reference: string;
  /** With an exam's notice: the subject it belongs to and the notice topics it teaches. */
  area: string | null;
  topics: string[];
};

/** A skill of an exam's graph moved into its notice subject, with the notice topics it teaches. */
export type SkillPlacement = { area: string; key: string; topics: string[] };

/** A skill already in an exam's graph whose weight the references show is off, and its new one. */
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

/**
 * Where a missing skill's quote comes from: a reference that contains it, or, with an exam's
 * notice, the notice itself when the quote is one of its topics (by id or in its words).
 */
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

/** A missing skill's place in an exam's notice; none without one. */
function toPlace({ outline, skill }: { outline?: ExamOutline; skill: RawMissingSkill }) {
  if (!outline) {
    return { area: null, topics: [] };
  }

  return placeInExam({ area: skill.area, outline, topics: [...skill.topics, skill.syllabusLine] });
}

/**
 * Keeps only gaps the references really show: each missing skill must quote a
 * line found in a reference or, for an exam, one of its notice's topics (a quote
 * the model made up is dropped), must not repeat a skill already in the graph,
 * and may only point at prerequisites the graph has. An exam's new skills keep
 * their weight, from 1 to 5, and their place in the notice, word for word.
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
  const graphNames = new Set(graphSkills.map((skill) => normalizeString(skill.name)));

  const comparableReferences = references.map((reference) => ({
    comparableText: comparable(reference.text),
    title: reference.title,
  }));

  const found = missing.flatMap((skill) => {
    const source = findSource({ outline, references: comparableReferences, skill });
    const name = skill.name.trim();

    if (!source || !name || graphNames.has(normalizeString(name))) {
      return [];
    }

    return [
      {
        ...toPlace({ outline, skill }),
        description: skill.description.trim(),
        examWeight: exam ? toExamWeight(skill.examWeight) : null,
        name,
        prerequisites: [...new Set(skill.prerequisites)].filter((key) => graphKeys.has(key)),
        reference: source.reference,
        syllabusLine: source.line,
      },
    ];
  });

  const names = found.map((skill) => normalizeString(skill.name));

  return found.filter((_, index) => names.indexOf(names[index] ?? "") === index);
}

/**
 * Keeps the weight changes an exam's graph can take: one per skill the graph has, from 1 to 5,
 * and only where the weight really changes. Other goals aren't weighted, so they get none.
 */
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
 * The placements an exam's graph can take: one per skill it has, in the notice's own subjects and
 * topics (see `placeInExam`), and only where the skill really moves. Without a notice there are
 * none.
 */
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

  const valid = placements.flatMap((placement) => {
    const skill = skills.get(placement.key);
    const placed = { key: placement.key, ...placeInExam({ ...placement, outline }) };

    return skill && !isSamePlace({ placement: placed, skill }) ? [placed] : [];
  });

  return valid.filter(
    (item, index) => valid.findIndex((other) => other.key === item.key) === index,
  );
}
