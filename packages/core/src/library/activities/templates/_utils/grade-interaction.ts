import { type ActivityAnswer } from "../../activity-answer-schema";
import { type ActivityCell, type ActivityExpectedAnswer } from "../../activity-expected-answer";
import { isCompleteMolecule } from "./chemistry";
import { sentenceKey } from "./language";
import { notesPitchClasses, rhythmTapOffsets } from "./music";
import { formulaPassesExamples, regexPassesExamples } from "./pattern-checks";
import { characters } from "./template-helpers";
import { normalizeProgramOutput } from "./text-normalizers";

type ExpectedOf<TKind extends ActivityExpectedAnswer["kind"]> = Extract<
  ActivityExpectedAnswer,
  { kind: TKind }
>;

function sameList(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((item, index) => item === second[index]);
}

function sameSet(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && sameList(first.toSorted(), second.toSorted());
}

function rowKeys(rows: readonly (readonly ActivityCell[])[]): string[] {
  return rows.map((row) => JSON.stringify(row));
}

function linkKeys(links: readonly { from: string; to: string }[]): string[] {
  return links.map((link) => JSON.stringify([link.from, link.to]));
}

/** Genotypes compare with the dominant allele first, however the learner ordered the pair. */
function genotypeKey(cell: string): string {
  return characters(cell.trim()).toSorted().join("");
}

function gradeAssignment(expected: ExpectedOf<"assignment">, answer: ActivityAnswer): boolean {
  const keys = Object.keys(expected.pairs);

  return (
    answer.kind === "assignment" &&
    keys.length === Object.keys(answer.pairs).length &&
    keys.every((key) => expected.pairs[key] === answer.pairs[key])
  );
}

function gradeCurveShift(expected: ExpectedOf<"curveShift">, answer: ActivityAnswer): boolean {
  return (
    answer.kind === "curveShift" &&
    answer.curve === expected.curve &&
    answer.direction === expected.direction
  );
}

function gradeGrid(expected: ExpectedOf<"grid">, answer: ActivityAnswer): boolean {
  return (
    answer.kind === "grid" &&
    sameList(
      answer.cells.map((cell) => genotypeKey(cell)),
      expected.cells.map((cell) => genotypeKey(cell)),
    )
  );
}

function gradeText(expected: ExpectedOf<"text">, answer: ActivityAnswer): boolean {
  return (
    answer.kind === "text" &&
    expected.accepted.map((sentence) => sentenceKey(sentence)).includes(sentenceKey(answer.text))
  );
}

function gradeRows(expected: ExpectedOf<"rows">, answer: ActivityAnswer): boolean {
  if (answer.kind !== "rows") {
    return false;
  }

  const [expectedRows, answerRows] = [rowKeys(expected.rows), rowKeys(answer.rows)];

  const sameColumns = sameList(
    expected.columns.map((column) => column.toLowerCase()),
    answer.columns.map((column) => column.toLowerCase()),
  );

  return expected.orderMatters
    ? sameColumns && sameList(expectedRows, answerRows)
    : sameColumns && sameList(expectedRows.toSorted(), answerRows.toSorted());
}

/** Every tap lands within the tolerance once the device's steady delay is taken out. */
function gradeRhythm(expected: ExpectedOf<"rhythm">, answer: ActivityAnswer): boolean {
  const offsets =
    answer.kind === "rhythm"
      ? rhythmTapOffsets({
          deviceDelayMs: answer.deviceDelayMs,
          expectedMs: expected.tapTimesMs,
          tapsMs: answer.tapTimesMs,
        })
      : null;

  return offsets !== null && offsets.every((offset) => Math.abs(offset) <= expected.toleranceMs);
}

function gradeNotes(expected: ExpectedOf<"pitchClasses">, answer: ActivityAnswer): boolean {
  const played = answer.kind === "notes" ? notesPitchClasses(answer.notes) : null;
  return played !== null && sameList(played.map(String), expected.pitchClasses.map(String));
}

function gradeIds(expected: ExpectedOf<"order" | "selection">, answer: ActivityAnswer): boolean {
  if (answer.kind !== expected.kind) {
    return false;
  }

  return expected.kind === "order"
    ? sameList(answer.ids, expected.ids)
    : sameSet(answer.ids, expected.ids);
}

function gradeLinks(expected: ExpectedOf<"links">, answer: ActivityAnswer): boolean {
  return answer.kind === "links" && sameSet(linkKeys(answer.links), linkKeys(expected.links));
}

function gradeMolecule(expected: ExpectedOf<"molecule">, answer: ActivityAnswer): boolean {
  return answer.kind === "molecule" && isCompleteMolecule(answer, expected.elements);
}

function gradeOutput(expected: ExpectedOf<"output">, answer: ActivityAnswer): boolean {
  return answer.kind === "output" && normalizeProgramOutput(answer.output) === expected.output;
}

function gradePattern(expected: ExpectedOf<"formula" | "regex">, answer: ActivityAnswer): boolean {
  if (answer.kind !== "pattern") {
    return false;
  }

  return expected.kind === "formula"
    ? formulaPassesExamples(answer.pattern, expected)
    : regexPassesExamples(answer.pattern, expected);
}

/** Checks an interaction's end state against the expected answer code computed for it. */
export function matchesExpectedAnswer(
  expected: ActivityExpectedAnswer,
  answer: ActivityAnswer,
): boolean {
  switch (expected.kind) {
    case "assignment":
      return gradeAssignment(expected, answer);
    case "curveShift":
      return gradeCurveShift(expected, answer);
    case "formula":
    case "regex":
      return gradePattern(expected, answer);
    case "grid":
      return gradeGrid(expected, answer);
    case "links":
      return gradeLinks(expected, answer);
    case "molecule":
      return gradeMolecule(expected, answer);
    case "order":
    case "selection":
      return gradeIds(expected, answer);
    case "output":
      return gradeOutput(expected, answer);
    case "pitchClasses":
      return gradeNotes(expected, answer);
    case "rhythm":
      return gradeRhythm(expected, answer);
    case "rows":
      return gradeRows(expected, answer);
    case "text":
      return gradeText(expected, answer);
    default:
      return false;
  }
}
