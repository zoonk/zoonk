import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type MockPlan, type MockSectionPlan } from "./mock-plan";
import { type MockEssayCandidate, getDayWrittenParts, withWrittenParts } from "./written-parts";

export function planWrittenTest({
  day,
  essays,
  structure,
}: {
  day: number | null;
  essays: readonly MockEssayCandidate[];
  structure: ExamStructure | null;
}): MockPlan {
  const { sections, written } = withWrittenParts({
    day,
    essays,
    fullLength: true,
    sections: [],
    structure,
  });

  return {
    day,
    fullLength: false,
    minutes: sections.reduce((sum, section) => sum + section.minutes, 0),
    reused: 0,
    sections,
    written,
  };
}

export function outlineWrittenPrompts(input: Parameters<typeof getDayWrittenParts>[0]) {
  return getDayWrittenParts(input).flatMap((part) =>
    part.tasks.flatMap((task) =>
      Array.from({ length: task.count }, (_, slot) => ({
        itemId: `${task.key}:${slot}`,
        taskKey: task.key,
      })),
    ),
  );
}

export function onlyObjectiveStructure(structure: ExamStructure | null): ExamStructure | null {
  if (!structure?.mock) {
    return structure;
  }

  return {
    ...structure,
    formats: structure.formats.filter((format) => format.kind !== "essay"),
    mock: {
      ...structure.mock,
      sections: structure.mock.sections.filter((section) => section.kind === "objective"),
    },
  };
}

export function bindMockWriting({
  day,
  essays,
  sections,
  structure,
}: {
  day: number | null;
  essays: readonly MockEssayCandidate[];
  sections: MockSectionPlan[];
  structure: ExamStructure | null;
}): MockSectionPlan[] | null {
  const planned = sections.flatMap((section) => section.essays);

  if (planned.length !== essays.length) {
    return null;
  }

  if (essays.length === 0) {
    return sections;
  }

  const slots = outlineWrittenPrompts({ day, structure });

  const assigned = new Map(
    slots.flatMap((slot, index) => {
      const essay = essays[index];
      return essay?.taskKey === slot.taskKey ? [[slot.itemId, essay.itemId] as const] : [];
    }),
  );

  if (planned.some((id) => !assigned.has(id))) {
    return null;
  }

  return sections.map((section) => ({
    ...section,
    essays: section.essays.flatMap((id) => assigned.get(id) ?? []),
  }));
}
