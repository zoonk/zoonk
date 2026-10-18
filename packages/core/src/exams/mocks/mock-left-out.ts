import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type MockConditions } from "./mock-contract";
import { outlineMock } from "./mock-plan";
import { type MockLeftOut } from "./mock-view-contract";
import { type MockDayWrittenPart, getDayWrittenParts } from "./written-parts";

/** The kinds of section a mock can't run yet: it says so instead of asking other questions. */
const SECTION_PARTS = new Set<MockLeftOut["part"]>(["listening", "practical", "speaking"]);

/** The exam's typed formats a mock asks as the exam does once its bank has questions in them. */
export type MockTypedPart = Extract<MockLeftOut["part"], "numeric" | "shortAnswer">;

/** Formats the whole exam asks that a mock asks differently, or a phase it can't run at all. */
const FORMAT_PARTS: Partial<Record<ExamStructure["formats"][number]["kind"], MockLeftOut["part"]>> =
  { numeric: "numeric", oral: "speaking", practical: "practical", shortAnswer: "shortAnswer" };

function isSectionPart(kind: string | undefined): kind is MockLeftOut["part"] {
  return [...SECTION_PARTS].some((part) => part === kind);
}

/** A section of the exam day the mock doesn't sit (a listening, speaking or practical paper). */
function isUnrunSection(part: MockLeftOut): part is MockLeftOut & { name: string } {
  return part.name !== null && isSectionPart(part.part);
}

/**
 * What a mock leaves out of the real exam, in the day's order and then the whole exam's (see
 * `MockLeftOut`). A full mock leaves out the day's sections it can't run and the written parts it
 * doesn't ask (`asked` names the ones it does, with the exam's essays); half of a day leaves out
 * every written part; a subject's mock sits none of the day's sections, so only the exam's
 * formats apply, but for the typed ones it asks as the exam does (`typed`).
 */
export function listMockLeftOut({
  asked,
  day,
  kind,
  running = new Set(),
  structure,
  typed,
}: {
  /** The written parts a full mock asks, by the notice's name. */
  asked: readonly string[];
  /**
   * The listening and speaking sections it sits, by the notice's name (its recordings, its
   * speaking paper).
   */
  running?: ReadonlySet<string>;
  /** The exam's typed formats the mock asks as the exam does (see `loadBankTypedParts`). */
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
    // A section of that kind anywhere in the exam already says it.
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

/**
 * A sat mock's written parts as it asks them: placed in the exam's order with as many essays as
 * its sections hold, so the parts it had essays for come first, as when it was planned.
 */
export function readMockWrittenParts({
  day,
  essays,
  fullLength,
  structure,
}: {
  day: number | null;
  /** How many essays the mock's sections hold. */
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

/**
 * What a sat mock left out (see `listMockLeftOut`): a mock taken any time by its shape, the plan's
 * by its length, and a diagnostic one, spread over the subjects, only the exam's formats.
 */
export function listSatMockLeftOut({
  conditions,
  structure,
  typed,
}: {
  conditions: Pick<MockConditions, "day" | "fullLength" | "purpose" | "sections" | "shape">;
  structure: ExamStructure | null;
  /** The exam's typed formats the mock asked (see `loadAskedTypedParts`). */
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

/**
 * The day's sections a mock sits, by the notice's names, when it leaves out one that isn't a
 * written part (see `MockOptionView.covers`); null when it sits every such section.
 */
export function listCoveredSections({
  asked,
  day,
  leftOut,
  structure,
}: {
  /** The written parts it asks, by the notice's names. */
  asked: readonly string[];
  day: number | null;
  leftOut: readonly MockLeftOut[];
  structure: ExamStructure | null;
}): string[] | null {
  const unrun = new Set(leftOut.flatMap((part) => (isUnrunSection(part) ? [part.name] : [])));

  if (unrun.size === 0) {
    return null;
  }

  // A written section is sat only when the mock asks its essay.
  const isSat = (section: { kind?: string; name: string }) =>
    !unrun.has(section.name) && (section.kind !== "written" || asked.includes(section.name));

  return (structure?.mock?.sections ?? [])
    .filter((section) => section.day === day && isSat(section))
    .map((section) => section.name);
}
