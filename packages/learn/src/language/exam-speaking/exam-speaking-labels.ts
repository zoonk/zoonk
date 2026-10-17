"use client";

import {
  type SpeakingCriterionView,
  type SpeakingTaskView,
} from "@zoonk/core/language/exam-speaking/contract";
import { getLevelStanding } from "@zoonk/core/language/exam-speaking/standing";
import { useExtracted, useFormatter } from "next-intl";

/** Goethe's letters, A the best: band 4 is A and band 0 is E. */
const LETTERS = ["E", "D", "C", "B", "A"];

const POINT_DIGITS = 2;

type BandRange = { bandHigh: number; bandLow: number };

/** "2", or "1–2" for a range. */
function span(low: string, high: string): string {
  return low === high ? low : `${low}–${high}`;
}

/**
 * What each official criterion rates, in the learner's words, beside its official name in the
 * exam's language: "Fluidez" reads as fluency to a Portuguese speaker, "Aufgabenerfüllung" doesn't.
 */
export function useCriterionGloss() {
  const t = useExtracted();

  const glosses: Record<string, string> = {
    accuracy: t("Accuracy"),
    coherence: t("Coherence"),
    discourse: t("Organizing what you say"),
    fluency: t("Fluency"),
    global: t("Overall impression"),
    grammar: t("Grammar"),
    grammarVocabulary: t("Grammar and vocabulary"),
    holistic: t("Overall impression"),
    interaction: t("Interaction"),
    interviewer: t("The examiner's overall rating"),
    language: t("Language"),
    languageUse: t("Use of language"),
    lexis: t("Vocabulary"),
    pronunciation: t("Pronunciation"),
    questions: t("Questions and answers"),
    range: t("Range of language"),
    taskCompletion: t("Doing the task"),
    vocabulary: t("Vocabulary"),
  };

  return (criterion: Pick<SpeakingCriterionView, "key" | "name">) =>
    glosses[criterion.key] ?? criterion.name;
}

/** Whom the AI plays in a task, as its row says it: always marked as the AI. */
export function useTaskRoleLabel() {
  const t = useExtracted();

  return (role: SpeakingTaskView["role"]) =>
    role === "partner" ? t("With another candidate (AI)") : t("With an examiner (AI)");
}

/**
 * The AI's part in the learner's language ("examiner", "other candidate"), one word wherever the
 * app names it; the card keeps the exam's own word ("entrevistador") in the exam's language.
 */
export function useTaskRoleNoun() {
  const t = useExtracted();

  return (role: SpeakingTaskView["role"]) =>
    role === "partner" ? t("other candidate") : t("examiner");
}

/**
 * A criterion's estimate on its official scale: a band ("2–3 of 3", Cambridge's "3.5 of 5"), a
 * letter ("B–C", A the best) or the points its line gives ("3–4 of 5 points").
 */
export function useBandText() {
  const t = useExtracted();
  const format = useFormatter();

  const number = (value: number) => format.number(value, { maximumFractionDigits: POINT_DIGITS });

  return ({ bandHigh, bandLow }: BandRange, criterion: SpeakingCriterionView): string => {
    if (criterion.display === "letter") {
      return span(LETTERS[Math.round(bandHigh)] ?? "", LETTERS[Math.round(bandLow)] ?? "");
    }

    if (criterion.display === "points" && criterion.points) {
      const points = (band: number) => criterion.points?.[Math.round(band)] ?? 0;

      return t("{range} of {max} points", {
        max: number(criterion.points.at(-1) ?? 0),
        range: span(number(points(bandLow)), number(points(bandHigh))),
      });
    }

    return t("{range} of {max}", {
      max: number(criterion.maxBand),
      range: span(number(bandLow), number(bandHigh)),
    });
  };
}

/**
 * Where an estimate stands against the exam's level, as its row says it: "At B2", "Near B2" (only
 * the top of its range reaches the level) or "Below B2".
 */
export function useStandingText() {
  const t = useExtracted();

  return (grade: BandRange, criterion: SpeakingCriterionView, level: string) => {
    const standing = getLevelStanding({ ...grade, levelMark: criterion.levelMark });

    const texts = {
      at: t("At {level}", { level }),
      below: t("Below {level}", { level }),
      near: t("Near {level}", { level }),
    };

    return { standing, text: texts[standing] };
  };
}
