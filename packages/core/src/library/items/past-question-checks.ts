import { type PastQuestion } from "@zoonk/ai/tasks/v2/items/past-questions";

const DASHES = /[-­‐-―−]/gu;
const SINGLE_QUOTES = /[‘’‚‛′]/gu;
const DOUBLE_QUOTES = /[“”„‟″]/gu;
const WHITESPACE = /\s+/gu;

/**
 * Text as printed and as extracted from a PDF differ in line breaks, hyphenation at line ends,
 * spaces inside words and the shape of quotes and dashes, but never in the words and signs
 * themselves. Both sides drop spacing and dashes, so only a real change of wording fails.
 */
function toComparableText(text: string): string {
  return text
    .normalize("NFKC")
    .replaceAll(SINGLE_QUOTES, "'")
    .replaceAll(DOUBLE_QUOTES, '"')
    .replaceAll(DASHES, "")
    .replaceAll(WHITESPACE, "");
}

/** The parts of a question that must be copied as printed: support text, command and options. */
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

/**
 * What's wrong with one past question before it can be stored: every quoted part must appear in
 * the paper as printed, the citation must name the question's number, and it must be tagged with
 * one of the skills it was asked about. Empty when it can be quoted.
 */
export function checkPastQuestion({
  paperText,
  question,
  skillCount,
}: {
  paperText: string;
  question: PastQuestion;
  skillCount: number;
}): string[] {
  const paper = toComparableText(paperText);
  const number = question.number.trim();
  const citesNumber = number.length > 0 && question.citation.includes(number);
  const hasSkill = question.skill >= 1 && question.skill <= skillCount;

  const quoteProblems = getQuotedParts(question.item).flatMap(({ label, text }) => {
    const quoted = toComparableText(text);
    return quoted && paper.includes(quoted) ? [] : [`${label} isn't in the paper as printed.`];
  });

  // A printed question is copied as it is, never with a new drawing of its figure.
  const asksForPicture = "image" in question.item && question.item.image !== null;

  return [
    ...quoteProblems,
    ...(citesNumber ? [] : ["The citation doesn't name the question's number."]),
    ...(hasSkill ? [] : ["The question isn't tagged with one of the skills."]),
    ...(asksForPicture ? ["The question depends on a figure, which can't be copied."] : []),
  ];
}
