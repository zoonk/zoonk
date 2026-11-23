import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { findSubjectSections, getObjectiveSectionNames } from "./exam-parts";
import { type MockOptionView } from "./mock-contract";
import { estimateMockMinutes } from "./mock-estimate";
import { type MockTypedPart, listCoveredSections, listMockLeftOut } from "./mock-left-out";
import { type MockPlan, getMockDays, outlineMock } from "./mock-plan";
import { type UnpickedChoice, listLeftOutChoices } from "./mock-unpicked";
import { countPartEssays, getDayWrittenParts } from "./written-parts";
import { isObjectiveSection } from "./written-subject";
import {
  onlyObjectiveStructure,
  outlineWrittenPrompts,
  planWrittenTest,
} from "./written-test-plan";

type MockOption = MockOptionView;
type Subject = ExamStructure["subjects"][number];

function getDayObjectiveSections({
  day,
  structure,
}: {
  day: number | null;
  structure: ExamStructure | null;
}) {
  return (structure?.mock?.sections ?? []).filter(
    (section) => section.day === day && isObjectiveSection(section),
  );
}

export function isPartOfAnother({
  subject,
  subjects,
}: {
  subject: Subject;
  subjects: readonly Subject[];
}): boolean {
  return Boolean(subject.partOf) && subjects.some((other) => other.name === subject.partOf);
}

function getDayAreas({
  day,
  subjects,
  structure,
}: {
  day: number | null;
  subjects: readonly Subject[];
  structure: ExamStructure | null;
}): string[] {
  const objective = getDayObjectiveSections({ day, structure });
  const named = objective.map((section) => section.name).filter((name) => name.trim().length > 0);
  const sections = getObjectiveSectionNames(structure);

  const isOnDay = (subject: Subject) =>
    findSubjectSections({ sections, structure, subject }).some((name) => named.includes(name));

  const asked =
    getMockDays(structure).length > 1 && named.length > 0
      ? subjects.filter((subject) => isOnDay(subject))
      : subjects;

  return asked
    .filter((subject) => !isPartOfAnother({ subject, subjects }))
    .map((subject) => subject.name);
}

function listOptionSections({
  outline,
  structure,
}: {
  outline: MockPlan;
  structure: ExamStructure | null;
}): MockOption["sections"] {
  const sections = (structure?.mock?.sections ?? []).filter(
    (section) => section.day === outline.day,
  );

  const running = outline.sections.flatMap((section) => {
    if (!section.name || (section.questions === 0 && !section.kind)) {
      return [];
    }

    const source = sections.find((entry) => entry.name === section.name);

    return [
      {
        kind: section.kind ?? ("objective" as const),
        minutes: section.minutes,
        name: section.name,
        questions: section.kind === "speaking" ? null : section.questions,
        session: source?.session ?? null,
      },
    ];
  });

  const written = getDayWrittenParts({ day: outline.day, structure })
    .filter((part) => outline.written.some((entry) => entry.asked && entry.name === part.name))
    .map((part) => ({
      kind: "written" as const,
      minutes: part.minutes,
      name: part.name,
      questions: countPartEssays(part),
      session: part.tasks[0]?.session ?? null,
    }));

  const order = new Map(sections.map((section, index) => [section.name, index]));

  const covered = [...running, ...written].toSorted(
    (a, b) => (order.get(a.name) ?? sections.length) - (order.get(b.name) ?? sections.length),
  );

  return covered.length > 0 ? covered : undefined;
}

function toDayOption({
  day,
  kind,
  listening,
  pace,
  speaking,
  subjects,
  structure,
  typed,
  unpicked,
}: {
  day: number | null;
  kind: "full" | "half";
  listening: ReadonlySet<string>;
  pace: number | null;
  speaking: boolean;
  subjects: readonly Subject[];
  structure: ExamStructure | null;
  typed: readonly MockTypedPart[];
  unpicked: readonly UnpickedChoice[];
}): MockOption {
  const outline = outlineMock({
    day,
    essays: outlineWrittenPrompts({ day, structure }),
    fullLength: kind === "full",
    listening,
    speaking,
    structure,
  });

  const running = new Set(
    outline.sections.flatMap((section) => (section.kind && section.name ? [section.name] : [])),
  );

  const asked = outline.written.filter((part) => part.asked).map((part) => part.name);
  const choices = listLeftOutChoices({ day, kind, unpicked });
  const leftOut = listMockLeftOut({ asked, choices, day, kind, running, structure, typed });
  const questions = outline.sections.reduce((sum, section) => sum + section.questions, 0);

  return {
    area: null,
    areas: getDayAreas({ day, structure, subjects }),
    covers: listCoveredSections({ asked, day, leftOut, structure }),
    day,
    estimatedMinutes: estimateMockMinutes({
      minutes: outline.minutes,
      pace,
      questions,
      sections: outline.sections,
      written: outline.written,
    }),
    kind,
    leftOut,
    minutes: outline.minutes,
    objectiveOnly: kind === "half",
    questions,
    sections: listOptionSections({ outline, structure }),
    written: asked,
  };
}

export function listDayOptions({
  listening,
  pace,
  speaking,
  structure,
  subjects,
  typed,
  unpicked,
}: Omit<Parameters<typeof toDayOption>[0], "day" | "kind">): MockOption[] {
  const days = getMockDays(structure);
  const shared = { listening, pace, speaking, structure, subjects, typed, unpicked };

  const full = days.flatMap<MockOption>((day) => {
    const both = toDayOption({ ...shared, day, kind: "full" });
    const parts = getDayWrittenParts({ day, structure });

    if (parts.length === 0) {
      return [both];
    }

    const outline = planWrittenTest({
      day,
      essays: outlineWrittenPrompts({ day, structure }),
      structure,
    });

    const written: MockOption = {
      ...both,
      areas: [],
      covers: null,
      estimatedMinutes: outline.minutes,
      kind: "written",
      leftOut: [],
      minutes: outline.minutes,
      objectiveOnly: false,
      pacing: parts.every((part) => part.minutes !== null) ? "official" : "practice",
      questions: 0,
      sections: listOptionSections({ outline, structure }),
      written: parts.map((part) => part.name),
    };

    const objectiveSessions = getDayObjectiveSections({ day, structure }).map(
      (section) => section.session,
    );

    const hasOtherPapers = structure?.mock?.sections.some(
      (section) =>
        section.day === day && section.kind !== "written" && !isObjectiveSection(section),
    );

    const separate =
      both.questions > 0 &&
      objectiveSessions.length > 0 &&
      (!hasOtherPapers || objectiveSessions.every((session) => session !== undefined)) &&
      parts.every(
        (part) =>
          part.minutes !== null &&
          part.tasks.every((task) =>
            task.session === null ? !hasOtherPapers : !objectiveSessions.includes(task.session),
          ),
      );

    if (!separate) {
      return [both, written];
    }

    const objective = toDayOption({
      ...shared,
      day,
      kind: "full",
      listening: new Set(),
      speaking: false,
      structure: onlyObjectiveStructure(structure),
    });

    return [{ ...objective, kind: "objective", objectiveOnly: true }, written, both];
  });

  const halves = days.map((day) => toDayOption({ ...shared, day, kind: "half" }));

  return [...full, ...halves];
}
