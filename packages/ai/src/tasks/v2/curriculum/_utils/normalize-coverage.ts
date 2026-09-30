import { normalizeString } from "@zoonk/utils/string";
import { toExamWeight } from "./exam-weight";

export type CoverageReference = { title: string; text: string };

type RawMissingSkill = {
  description: string;
  examWeight: number | null;
  name: string;
  prerequisites: string[];
  syllabusLine: string;
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
};

/** A skill already in an exam's graph whose weight the references show is off, and its new one. */
export type ExamWeightChange = { examWeight: number; key: string };

type GraphSkill = { examWeight?: number | null; key: string; name: string };

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
 * Keeps only gaps the references really show: each missing skill must quote a
 * line found in a reference (a quote the model made up is dropped), must not
 * repeat a skill already in the graph, and may only point at prerequisites
 * the graph has. An exam's new skills keep their weight, from 1 to 5.
 */
export function normalizeCoverage({
  exam,
  graphSkills,
  missing,
  references,
}: {
  exam: boolean;
  graphSkills: readonly GraphSkill[];
  missing: readonly RawMissingSkill[];
  references: readonly CoverageReference[];
}): MissingSkill[] {
  const graphKeys = new Set(graphSkills.map((skill) => skill.key));
  const graphNames = new Set(graphSkills.map((skill) => normalizeString(skill.name)));

  const comparableReferences = references.map((reference) => ({
    comparableText: comparable(reference.text),
    title: reference.title,
  }));

  const found = missing.flatMap((skill) => {
    const reference = findReference({ line: skill.syllabusLine, references: comparableReferences });
    const name = skill.name.trim();

    if (!reference || !name || graphNames.has(normalizeString(name))) {
      return [];
    }

    return [
      {
        description: skill.description.trim(),
        examWeight: exam ? toExamWeight(skill.examWeight) : null,
        name,
        prerequisites: [...new Set(skill.prerequisites)].filter((key) => graphKeys.has(key)),
        reference,
        syllabusLine: skill.syllabusLine.trim(),
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
