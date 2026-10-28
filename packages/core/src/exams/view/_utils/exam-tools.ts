import { type ExamStructure } from "../../../library/exams/blueprint-contract";

export function listExamTools(structure: ExamStructure | null): string[] {
  const sections = (structure?.mock?.sections ?? []).flatMap((section) =>
    section.tools ? [{ name: section.name, tools: section.tools }] : [],
  );

  const sentences = [...new Set(sections.map((section) => section.tools))];

  return sentences.length <= 1
    ? sentences
    : sections.map((section) => `${section.name}: ${section.tools}`);
}
