import { type ExamStructure, type SectionNavigation } from "../../library/exams/blueprint-contract";
import { listListeningParts } from "../listening/listening-parts";
import { isObjectiveSection } from "./written-subject";

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

export function toSectionRules(section: BlueprintSection) {
  return {
    breakAfterMinutes: section.breakAfterMinutes ?? null,
    navigation: section.navigation ?? null,
    tools: section.tools ?? null,
  };
}

export function getObjectiveSections(structure: ExamStructure | null): StructureSection[] {
  return (structure?.mock?.sections ?? []).filter((section) => isObjectiveSection(section));
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
  const sections = (structure?.mock?.sections ?? []).filter((section) => section.day === day);

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
    return Math.max(1, Math.round((section.minutes * picked) / questions));
  }

  return Math.max(1, Math.round(picked * pace));
}
