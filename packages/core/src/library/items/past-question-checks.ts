import { type PastQuestion, type PastQuestionFormat } from "@zoonk/ai/tasks/items/past-questions";
import { splitAtMath } from "@zoonk/utils/math-spans";
import { NO_SPACE_SCRIPT } from "@zoonk/utils/string";
import { checkItem } from "./item-checks";
import { repairItem } from "./item-repairs";

const DASHES = /[-­‐-―−]/gu;
const SINGLE_QUOTES = /[‘’‚‛′]/gu;
const DOUBLE_QUOTES = /[“”„‟″]/gu;
const WHITESPACE = /\s+/gu;
const TABLE_DELIMITER_ROW = /^[|:]+$/u;
const WORD = /\p{L}{2,}/gu;
const LETTER_RUN = /[\p{L}\p{M}]+/gu;
const LOWERCASE = /\p{Ll}/u;
const PAGE_LINE = /[\n\f]/u;
const ESCAPED_DOLLAR = /\\\$/gu;
const FORMULA_TOKEN = /\\[A-Za-z]+|[\p{L}\p{N}]/gu;

/**
 * LaTeX names Greek letters and symbols with commands (`\alpha`, `\cdot`, `\sqrt`), so the paper's
 * own `α`, `·` and `√` sit between a formula's Latin letters and digits.
 */
const FORMULA_GAP = String.raw`[^\p{Script=Latin}\p{N}]*`;

/**
 * A page's own notes are phrases ("Use this space for computations.", a running header) repeated
 * page after page (8 to 16 times in real papers); an instruction a few questions share repeats
 * less, and a figure's lone labels and symbols ("α", "Tempo") aren't phrases.
 */
const PAGE_NOTE_REPEATS = 5;
const PAGE_NOTE_WORDS = 3;

/**
 * Longer than the words the papers print (Portuguese ones stop near 18 letters), so in text that
 * lost its spaces it's words run together.
 */
const RUN_TOGETHER_LETTERS = 20;

/**
 * The PDF reader drops the spaces between words in some papers (Enem's), leaving a quarter of their
 * letters in runs that long; a paper read well has almost none, whatever its language.
 */
const LOST_SPACES_SHARE = 0.1;

/** Spaces, line breaks, hyphens and quote marks vary with how the paper was read, not with its wording. */
function toComparableText(text: string): string {
  return text
    .normalize("NFKC")
    .replaceAll(SINGLE_QUOTES, "'")
    .replaceAll(DOUBLE_QUOTES, '"')
    .replaceAll(DASHES, "")
    .replaceAll(WHITESPACE, "");
}

function isPhrase(line: string): boolean {
  return (line.match(WORD)?.length ?? 0) >= PAGE_NOTE_WORDS && !line.includes("|");
}

function findPageNotes(paperText: string): Set<string> {
  const phrases = paperText
    .split(PAGE_LINE)
    .filter((line) => isPhrase(line))
    .map((line) => toComparableText(line));

  const repeats = Map.groupBy(phrases, (line) => line);

  return new Set(phrases.filter((line) => (repeats.get(line)?.length ?? 0) >= PAGE_NOTE_REPEATS));
}

type ComparablePaper = { notes: Set<string>; printed: string; withoutNotes: string };

function toComparablePaper(paperText: string): ComparablePaper {
  const lines = paperText.split(PAGE_LINE).map((line) => toComparableText(line));
  const notes = findPageNotes(paperText);

  return {
    notes,
    printed: lines.join(""),
    withoutNotes: lines.filter((line) => !notes.has(line)).join(""),
  };
}

/**
 * The paper's text reader flattens math (`x4y`, `C A0`, `x²`), so a formula matches by its letters
 * and digits in order, and a command's name may be printed (`\log`) or not (`\cdot`).
 */
function toFormulaPattern(formula: string): string {
  const tokens = (formula.normalize("NFKC").match(FORMULA_TOKEN) ?? []).map((token) =>
    token.startsWith("\\") ? `(?:${token.slice(1)})?` : RegExp.escape(token),
  );

  return ["", ...tokens, ""].join(FORMULA_GAP);
}

type QuoteLine = { comparable: string; pattern: string };

function toQuoteLine(line: string): QuoteLine {
  const pattern = splitAtMath(line)
    .map((segment) =>
      segment.kind === "text"
        ? RegExp.escape(toComparableText(segment.text.replaceAll(ESCAPED_DOLLAR, "$")))
        : toFormulaPattern(segment.text),
    )
    .join("");

  return { comparable: toComparableText(line), pattern };
}

function isIn(paper: string, lines: QuoteLine[]): boolean {
  return (
    lines.some((line) => line.comparable.length > 0) &&
    new RegExp(lines.map((line) => line.pattern).join(""), "u").test(paper)
  );
}

/**
 * A table's `| --- |` row is the formatting it needs to show as one, so it isn't compared. A
 * quote matches as printed, or with page notes left out of both sides; a command every question
 * repeats ("Assinale a alternativa correta.") is a page note too, and matches as printed.
 */
function isQuoted({ paper, text }: { paper: ComparablePaper; text: string }): boolean {
  const lines = text
    .split("\n")
    .map((line) => toQuoteLine(line))
    .filter((line) => !TABLE_DELIMITER_ROW.test(line.comparable));

  return (
    isIn(paper.printed, lines) ||
    isIn(
      paper.withoutNotes,
      lines.filter((line) => !paper.notes.has(line.comparable)),
    )
  );
}

function findLetterRuns(text: string): string[] {
  return (text.match(LETTER_RUN) ?? []).filter((run) => !NO_SPACE_SCRIPT.test(run));
}

function countLetters(runs: string[]): number {
  return runs.reduce((total, run) => total + run.length, 0);
}

/** Capitals alone are a code or a sequence ("AUGGCCAUUGUAAUGGGCCGC"), not words run together. */
function isRunTogether(run: string): boolean {
  return run.length >= RUN_TOGETHER_LETTERS && LOWERCASE.test(run);
}

function hasLostSpaces(paperText: string): boolean {
  const runs = findLetterRuns(paperText);
  const letters = countLetters(runs);
  const runTogether = runs.filter((run) => isRunTogether(run));

  return letters > 0 && countLetters(runTogether) >= LOST_SPACES_SHARE * letters;
}

function findRunTogetherWords(text: string): string[] {
  return findLetterRuns(text).filter((run) => isRunTogether(run));
}

function getQuotedParts(item: PastQuestion["item"]): { label: string; text: string }[] {
  const context = item.context ? [{ label: "The support text", text: item.context }] : [];

  if (item.format === "trueFalse") {
    return [...context, { label: "The statement", text: item.statement }];
  }

  return [
    ...context,
    { label: "The command", text: item.question },
    ...item.options.map((option, index) => ({ label: `Option ${index + 1}`, text: option.text })),
  ];
}

function findQuoteProblems({
  paperText,
  question,
}: {
  paperText: string;
  question: PastQuestion;
}): string[] {
  const paper = toComparablePaper(paperText);
  const lostSpaces = hasLostSpaces(paperText);

  return getQuotedParts(question.item).flatMap(({ label, text }) => {
    const runTogether = lostSpaces ? findRunTogetherWords(text) : [];

    return [
      ...(isQuoted({ paper, text }) ? [] : [`${label} isn't in the paper as printed.`]),
      ...runTogether.map(
        (run) => `${label} runs words together as the paper's text does: "${run}".`,
      ),
    ];
  });
}

/** The import and its eval run this one gate: repair what code can, then check the rest. */
export function checkPastQuestion({
  paperText,
  question: written,
  target,
}: {
  paperText: string;
  question: PastQuestion;
  target: {
    format: PastQuestionFormat;
    language: string;
    optionCount: number | null;
    skillCount: number;
  };
}): { problems: string[]; question: PastQuestion } {
  const { format, language, optionCount, skillCount } = target;
  const item = repairItem({ item: written.item, language, optionCount });
  const question = { ...written, item };
  const number = question.number.trim();
  const citesNumber = number.length > 0 && question.citation.includes(number);
  const hasSkill = question.skill >= 1 && question.skill <= skillCount;
  const asksForPicture = "image" in item && item.image !== null;

  const problems = [
    ...checkItem({ expectedFormat: format, item, language, optionCount }),
    ...findQuoteProblems({ paperText, question }),
    ...(citesNumber ? [] : ["The citation doesn't name the question's number."]),
    ...(hasSkill ? [] : ["The question isn't tagged with one of the skills."]),
    ...(asksForPicture ? ["The question depends on a figure, which can't be copied."] : []),
  ];

  return { problems, question };
}
