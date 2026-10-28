import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type MockConditions } from "./mock-contract";
import { outlineMock } from "./mock-plan";
import { type MockLeftOut } from "./mock-view-contract";
import { type MockDayWrittenPart, getDayWrittenParts } from "./written-parts";

const SECTION_PARTS = new Set<MockLeftOut["part"]>(["listening", "practical", "speaking"]);

export type MockTypedPart = Extract<MockLeftOut["part"], "numeric" | "shortAnswer">;

const FORMAT_PARTS: Partial<Record<ExamStructure["formats"][number]["kind"], MockLeftOut["part"]>> =
  { numeric: "numeric", oral: "speaking", practical: "practical", shortAnswer: "shortAnswer" };

function isSectionPart(kind: string | undefined): kind is MockLeftOut["part"] {
  return [...SECTION_PARTS].some((part) => part === kind);
}

function isUnrunSection(part: MockLeftOut): part is MockLeftOut & { name: string } {
  return part.name !== null && isSectionPart(part.part);
}

export function listMockLeftOut({
  asked,
  day,
  kind,
  running = new Set(),
  structure,
  typed,
}: {
  asked: readonly string[];
  running?: ReadonlySet<string>;
  typed: readonly MockTypedPart[];
  day: number | null;
  kind: "area" | "full" | "half";
  structure: ExamStructure | null;
}): MockLeftOut[] {
  const allSections = structure?.mock?.sections ?? [];
  const sections = kind === "area" ? [] : allSections.filter((section) => section.day === day);

  const unrun = sections.flatMap((section): MockLeftOut[] =>
    isSectionPart(section.kind) && !running.has(section.name)
      ? [{ name: section.name, part: section.kind }]
      : [],
  );

  const writtenParts =
    kind === "area"
      ? []
      : getDayWrittenParts({ day, structure }).filter(
          (part) => kind === "half" || !asked.includes(part.name),
        );

  const formats = [
    ...new Set((structure?.formats ?? []).map((format) => FORMAT_PARTS[format.kind])),
  ]
    .filter((part) => part !== undefined)
    .filter((part) => !typed.some((format) => format === part))
    .filter((part) => !allSections.some((section) => section.kind === part))
    .map((part): MockLeftOut => ({ name: null, part }));

  return [
    ...unrun,
    ...writtenParts.map((part): MockLeftOut => ({
      name: part.name,
      part: kind === "half" ? "writtenInFull" : "written",
    })),
    ...formats,
  ];
}

export function readMockWrittenParts({
  day,
  essays,
  fullLength,
  structure,
}: {
  day: number | null;
  essays: number;
  fullLength: boolean;
  structure: ExamStructure | null;
}): MockDayWrittenPart[] {
  return outlineMock({
    day,
    essays: Array.from({ length: essays }, (_, index) => ({ area: null, itemId: String(index) })),
    fullLength,
    structure,
  }).written;
}

export function listSatMockLeftOut({
  conditions,
  structure,
  typed,
}: {
  conditions: Pick<MockConditions, "day" | "fullLength" | "purpose" | "sections" | "shape">;
  structure: ExamStructure | null;
  typed: readonly MockTypedPart[];
}): MockLeftOut[] {
  const running = new Set(
    conditions.sections.flatMap((section) => (section.kind && section.name ? [section.name] : [])),
  );

  const kind =
    conditions.purpose === "placement"
      ? "area"
      : (conditions.shape?.kind ?? (conditions.fullLength ? "full" : "half"));

  const essays = conditions.sections.reduce((sum, section) => sum + section.essays.length, 0);

  const asked = readMockWrittenParts({
    day: conditions.day,
    essays,
    fullLength: conditions.fullLength,
    structure,
  })
    .filter((part) => part.asked)
    .map((part) => part.name);

  return listMockLeftOut({ asked, day: conditions.day, kind, running, structure, typed });
}

export function listCoveredSections({
  asked,
  day,
  leftOut,
  structure,
}: {
  asked: readonly string[];
  day: number | null;
  leftOut: readonly MockLeftOut[];
  structure: ExamStructure | null;
}): string[] | null {
  const unrun = new Set(leftOut.flatMap((part) => (isUnrunSection(part) ? [part.name] : [])));

  if (unrun.size === 0) {
    return null;
  }

  const isSat = (section: { kind?: string; name: string }) =>
    !unrun.has(section.name) && (section.kind !== "written" || asked.includes(section.name));

  return (structure?.mock?.sections ?? [])
    .filter((section) => section.day === day && isSat(section))
    .map((section) => section.name);
}
