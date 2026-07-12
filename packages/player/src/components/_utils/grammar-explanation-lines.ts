import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type LessonKind } from "@zoonk/core/steps/contract/content";
import { describePlayerStep } from "../../player-step";

const FALLBACK_SENTENCE_PATTERN = /[^.!?。！？]+[.!?。！？]+(?:["')\]”’]+)?|[^.!?。！？]+$/gu;
const INLINE_CODE_PATTERN = /`[^`]*`/gu;
const SENTENCE_PUNCTUATION_PATTERN = /[.!?。！？]/gu;

/**
 * Hides sentence punctuation inside supported inline-code markers before text
 * is segmented. Grammar explanations often contrast examples such as
 * `Did she go?` and `Did she went?`; those question marks belong to the code
 * examples and must not split the markers that the rich-text renderer needs.
 * Spaces preserve every original index so segments can still slice the source
 * text without changing any learner-facing content.
 */
function getSentenceSegmentationText(text: string) {
  return text.replaceAll(INLINE_CODE_PATTERN, (inlineCode) =>
    inlineCode.replaceAll(SENTENCE_PUNCTUATION_PATTERN, " "),
  );
}

/**
 * Removes layout-only whitespace from generated prose before each sentence is
 * rendered as its own player line. The player already collapses whitespace in
 * regular paragraph rendering, so this keeps the split version visually
 * equivalent aside from the intentional sentence breaks.
 */
function normalizeSentenceLine(sentence: string) {
  return sentence.replaceAll(/\s+/gu, " ").trim();
}

/**
 * Filters empty strings after trimming generated prose. This keeps the main
 * splitter pipeline typed as `string[]` without relying on a broad Boolean cast.
 */
function isSentenceLine(line: string) {
  return line.length > 0;
}

/**
 * Uses the browser/runtime sentence segmenter when available because it handles
 * common grammar prose better than punctuation regexes, including abbreviations
 * such as "e.g." that should stay inside the same sentence.
 */
function getSegmenterSentenceLines(text: string): string[] | null {
  const SentenceSegmenter = Intl.Segmenter;

  if (!SentenceSegmenter) {
    return null;
  }

  const segmentationText = getSentenceSegmentationText(text);

  return Array.from(
    new SentenceSegmenter(undefined, { granularity: "sentence" }).segment(segmentationText),
    ({ index, segment }) => text.slice(index, index + segment.length),
  );
}

/**
 * Provides a small punctuation fallback for older runtimes that do not expose
 * `Intl.Segmenter`. It is intentionally conservative and only affects grammar
 * explanation display, not saved lesson content.
 */
function getFallbackSentenceLines(text: string) {
  const segmentationText = getSentenceSegmentationText(text);
  const matches = segmentationText.matchAll(FALLBACK_SENTENCE_PATTERN);

  return Array.from(matches, (match) => text.slice(match.index, match.index + match[0].length));
}

/**
 * Splits grammar explanation prose into display lines so long generated
 * explanations are easier to scan in the player while preserving the original
 * text content and punctuation.
 */
export function getGrammarExplanationSentenceLines(text: string) {
  const lines = (getSegmenterSentenceLines(text) ?? getFallbackSentenceLines(text))
    .map((sentence) => normalizeSentenceLine(sentence))
    .filter((line) => isSentenceLine(line));

  return lines.length > 0 ? lines : [text];
}

/**
 * Identifies text-only static steps. Grammar examples also use `static` steps,
 * so the content variant is part of the rule instead of relying on step kind
 * alone.
 */
function isStaticTextStep(step: SerializedStep) {
  return describePlayerStep(step)?.kind === "staticText";
}

/**
 * Finds the active step by id instead of trusting stored `position`, because the
 * reducer state is already the source of truth for the order the player is
 * rendering.
 */
function getStepIndex({ step, steps }: { step: SerializedStep; steps: SerializedStep[] }) {
  return steps.findIndex((candidate) => candidate.id === step.id);
}

/**
 * Checks that the current step still belongs to the leading static-text block.
 * This keeps sentence splitting limited to grammar explanation steps at the
 * start of the lesson and leaves grammar examples or any later static text
 * untouched.
 */
function hasOnlyStaticTextBeforeAndIncludingStep({
  stepIndex,
  steps,
}: {
  stepIndex: number;
  steps: SerializedStep[];
}) {
  return steps.slice(0, stepIndex + 1).every((step) => isStaticTextStep(step));
}

/**
 * Returns whether a static text step should use sentence-line rendering.
 * Grammar lessons are saved as explanation text first, followed by grammar
 * examples and questions, so this models the product rule directly in the
 * player without changing stored content.
 */
export function isInitialGrammarExplanationStep({
  lessonKind,
  step,
  steps,
}: {
  lessonKind: LessonKind;
  step: SerializedStep;
  steps: SerializedStep[];
}) {
  const stepIndex = getStepIndex({ step, steps });

  if (lessonKind !== "grammar" || stepIndex === -1) {
    return false;
  }

  return hasOnlyStaticTextBeforeAndIncludingStep({ stepIndex, steps });
}
