import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { explanationSchema } from "./contract/content-schemas";
import { normalizeStepContentValue } from "./contract/normalize-step-content";
import { safeParseStepContent } from "./contract/step-contract";
import { type ConvertedScreen } from "./written-screens";

/**
 * A question's basis that holds: the question's and its reading screen's places in the written
 * lesson (0-based), and the quote as it's stored.
 */
type QuestionBasis = { question: number; quote: string; reading: number };

/** A basis that doesn't hold, and why, for the writer's eval: production leaves it out. */
type QuestionBasisProblem = { problem: string; screen: number };

type BasisVerdict = { basis: QuestionBasis; ok: true } | { ok: false; problem: string };

/** The basis a written question gives, when it's a question that has one. */
function getWrittenBasis(screen: WrittenScreen | undefined) {
  if (screen?.kind === "check" || screen?.kind === "mathCheck" || screen?.kind === "typedAnswer") {
    return screen.basis;
  }

  return null;
}

/** Text as its screen stores it: trimmed, then repaired like every string of step content. */
function toStoredText(text: string): string {
  const stored = normalizeStepContentValue(text.trim());
  return typeof stored === "string" ? stored : text.trim();
}

/**
 * The texts of a reading screen as stored, the ones "From the lesson" shows: a hook's text, an
 * explanation's text, or a worked example's problem, steps and result. Null for any other screen.
 */
function getReadingTexts(screen: ConvertedScreen | undefined): string[] | null {
  if (!screen?.ok) {
    return null;
  }

  if (screen.kind === "hook") {
    const parsed = safeParseStepContent("hook", screen.content);
    return parsed.success && parsed.data.variant === "text" ? [parsed.data.text] : null;
  }

  if (screen.kind === "explanation") {
    const parsed = safeParseStepContent("explanation", screen.content);
    return parsed.success ? [parsed.data.text] : null;
  }

  if (screen.kind !== "workedExample") {
    return null;
  }

  const parsed = safeParseStepContent("workedExample", screen.content);

  return parsed.success
    ? [parsed.data.problem, ...parsed.data.steps.map((step) => step.text), parsed.data.result]
    : null;
}

/** Why a quote can't be marked as it is, or null when it can. */
function getQuoteProblem({
  quote,
  screen,
  texts,
}: {
  quote: string;
  screen: number;
  texts: readonly string[];
}): string | null {
  if (!explanationSchema.safeParse(quote).success || quote.includes("\n")) {
    return `Its basis quote isn't one sentence of screen ${String(screen)}: "${quote}".`;
  }

  return texts.some((text) => text.includes(quote))
    ? null
    : `Its basis quotes words screen ${String(screen)} doesn't have: "${quote}". Copy the sentence exactly as that screen says it.`;
}

function checkBasis({
  index,
  lesson,
  screens,
}: {
  index: number;
  lesson: WrittenLesson;
  screens: readonly ConvertedScreen[];
}): BasisVerdict | null {
  const basis = getWrittenBasis(lesson.screens[index]);

  if (!basis || !screens[index]?.ok) {
    return null;
  }

  const reading = basis.screen - 1;
  const texts = reading >= 0 && reading < index ? getReadingTexts(screens[reading]) : null;

  if (!texts) {
    return {
      ok: false,
      problem: `Its basis names screen ${String(basis.screen)}; name an earlier hook text, explanation or worked example.`,
    };
  }

  const quote = toStoredText(basis.quote);
  const problem = getQuoteProblem({ quote, screen: basis.screen, texts });

  return problem
    ? { ok: false, problem }
    : { basis: { question: index, quote, reading }, ok: true };
}

/**
 * The basis of each question in a written lesson (a check, a calculation or a typed answer) that
 * holds: an earlier reading screen the player can show (a hook's text, an explanation or a worked
 * example) whose stored text has the quote exactly, on one line. The others come back as problems
 * for the writer's eval; production leaves them out, since a question needs no basis.
 */
export function findQuestionBases({
  lesson,
  screens,
}: {
  lesson: WrittenLesson;
  screens: readonly ConvertedScreen[];
}): { bases: QuestionBasis[]; problems: QuestionBasisProblem[] } {
  const verdicts = lesson.screens.flatMap((_, index) => {
    const verdict = checkBasis({ index, lesson, screens });
    return verdict ? [{ index, verdict }] : [];
  });

  return {
    bases: verdicts.flatMap(({ verdict }) => (verdict.ok ? [verdict.basis] : [])),
    problems: verdicts.flatMap(({ index, verdict }) =>
      verdict.ok ? [] : [{ problem: verdict.problem, screen: index }],
    ),
  };
}

/**
 * The lesson's converted screens with each question's basis that holds in its content, naming its
 * reading screen by the position it's stored at (`positions`, by written index; null when that
 * screen isn't stored, which leaves the question without one).
 */
export function addQuestionBases({
  lesson,
  positions,
  screens,
}: {
  lesson: WrittenLesson;
  positions: readonly (number | null)[];
  screens: readonly ConvertedScreen[];
}): ConvertedScreen[] {
  const { bases } = findQuestionBases({ lesson, screens });
  const byQuestion = new Map(bases.map((basis) => [basis.question, basis]));

  return screens.map((screen, index) => {
    const basis = byQuestion.get(index);
    const position = basis ? positions[basis.reading] : null;

    if (!screen.ok || !basis || position === null || position === undefined) {
      return screen;
    }

    const parsed = safeParseStepContent(screen.kind, {
      ...screen.content,
      basis: { position, quote: basis.quote },
    });

    return parsed.success ? { ...screen, content: parsed.data } : screen;
  });
}
