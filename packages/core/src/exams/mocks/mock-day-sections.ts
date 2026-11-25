import { apportion, roundToTotal } from "@zoonk/utils/apportion";
import { type ExamStructure, type SectionNavigation } from "../../library/exams/blueprint-contract";
import { listListeningParts } from "../listening/listening-parts";
import { isObjectiveSection } from "./written-subject";

const DEFAULT_SECTION_QUESTIONS = 45;

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

export function toSectionRules(section: BlueprintSection) {
  return {
    breakAfterMinutes: section.breakAfterMinutes ?? null,
    navigation: section.navigation ?? null,
    tools: section.tools ?? null,
  };
}

/** The exam's total counts listening questions too, given for the section or for its parts. */
function statedQuestions(section: StructureSection): number {
  if (section.kind === "listening") {
    return section.questions ?? (section.tasks ?? []).reduce((sum, task) => sum + task.count, 0);
  }

  return isObjectiveSection(section) ? (section.questions ?? 0) : 0;
}

/**
 * A notice can state only the exam's total ("240 itens" over two sittings): the objective
 * sections without their own count share what the stated counts leave, by their minutes.
 */
function listCountedSections(structure: ExamStructure | null): StructureSection[] {
  const sections = structure?.mock?.sections ?? [];
  const total = structure?.mock?.totalQuestions ?? null;

  const uncounted = sections.filter(
    (section) => isObjectiveSection(section) && section.questions === null,
  );

  const stated = sections.reduce((sum, section) => sum + statedQuestions(section), 0);

  if (total === null || uncounted.length === 0 || total <= stated) {
    return sections;
  }

  const timed = uncounted.every((section) => section.minutes !== null);

  const counts = apportion({
    total: total - stated,
    weights: uncounted.map((section) => (timed ? (section.minutes ?? 0) : 1)),
  });

  const filled = new Map(uncounted.map((section, index) => [section, counts[index] ?? 0]));

  return sections.map((section) => {
    const questions = filled.get(section);
    return questions === undefined ? section : { ...section, questions };
  });
}

export function getObjectiveSections(structure: ExamStructure | null): StructureSection[] {
  return listCountedSections(structure).filter((section) => isObjectiveSection(section));
}

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
  const sections = listCountedSections(structure).filter((section) => section.day === day);

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
    return (section.minutes * picked) / questions;
  }

  return picked * pace;
}

export function sectionQuotas(sections: readonly BlueprintSection[], share: number) {
  return roundToTotal(
    sections.map((section) =>
      section.kind === "speaking" ? 0 : (section.questions ?? DEFAULT_SECTION_QUESTIONS) * share,
    ),
  );
}
