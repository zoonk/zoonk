import { type ExamStructure, type SectionNavigation } from "../../library/exams/blueprint-contract";
import { listListeningParts } from "../listening/listening-parts";
import { isObjectiveSection } from "./written-subject";

/** Without a stated size, a mock is a morning's worth of questions. */
export const DEFAULT_SECTION_QUESTIONS = 45;

export type BlueprintSection = {
  breakAfterMinutes?: number | null;
  kind?: StructureSection["kind"];
  minutes: number | null;
  name: string | null;
  navigation?: SectionNavigation | null;
  questions: number | null;
  tools?: string | null;
};

type StructureSection = NonNullable<ExamStructure["mock"]>["sections"][number];

/** A section's tools, how it's moved through and the break after it, as the notice states them. */
export function toSectionRules(section: BlueprintSection) {
  return {
    breakAfterMinutes: section.breakAfterMinutes ?? null,
    navigation: section.navigation ?? null,
    tools: section.tools ?? null,
  };
}

/** The objective sections of the exam: the ones a mock fills with questions. */
export function getObjectiveSections(structure: ExamStructure | null): StructureSection[] {
  return (structure?.mock?.sections ?? []).filter((section) => isObjectiveSection(section));
}

/**
 * One exam day's sections that ask questions, in the blueprint's order: its objective ones, its
 * listening ones that have recordings to play (`listening`, by name), and its speaking ones when
 * the mock sits the speaking paper (`speaking`); the whole mock as one section when the notice
 * doesn't split it.
 */
export function getDaySections({
  day,
  listening = new Set(),
  speaking = false,
  structure,
}: {
  day: number | null;
  listening?: ReadonlySet<string>;
  speaking?: boolean;
  structure: ExamStructure | null;
}): BlueprintSection[] {
  const sections = (structure?.mock?.sections ?? []).filter((section) => section.day === day);

  // A day of only a written test has no questions to pick.
  if (sections.length > 0) {
    return sections
      .filter(
        (section) =>
          isObjectiveSection(section) ||
          (section.kind === "listening" && listening.has(section.name)) ||
          (section.kind === "speaking" && speaking),
      )
      .map((section) => withPartQuestions({ section, structure }));
  }

  return [
    {
      minutes: structure?.mock?.timeLimitMinutes ?? null,
      name: null,
      questions: structure?.mock?.totalQuestions ?? DEFAULT_SECTION_QUESTIONS,
    },
  ];
}

/**
 * A listening section the notice doesn't count asks the questions of its recordings, one per
 * part (`listListeningParts`), as its mock plays them.
 */
function withPartQuestions<Section extends StructureSection>({
  section,
  structure,
}: {
  section: Section;
  structure: ExamStructure | null;
}): Section {
  if (section.kind !== "listening" || section.questions !== null || !structure) {
    return section;
  }

  const questions = listListeningParts(structure)
    .filter((part) => part.sectionName === section.name)
    .reduce((sum, part) => sum + part.count, 0);

  return questions > 0 ? { ...section, questions } : section;
}

/**
 * A section's minutes for the questions it asks: its share of the notice's time for the section
 * (the questions it would ask in full standing in for a count the notice doesn't give), else at
 * the exam's pace.
 */
export function sectionMinutes({
  pace,
  picked,
  section,
}: {
  pace: number;
  picked: number;
  section: BlueprintSection;
}): number {
  if (section.minutes) {
    const questions = section.questions ?? DEFAULT_SECTION_QUESTIONS;
    return Math.max(1, Math.round((section.minutes * picked) / questions));
  }

  return Math.max(1, Math.round(picked * pace));
}
