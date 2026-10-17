import {
  type LessonScreenSuggestion,
  type LessonTutorSuggestion,
} from "@zoonk/core/lesson-questions/contract";
import { DEFAULT_LOCALE, isValidLocale } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";

/**
 * The tutor's suggestions for a lesson's screens, worded once for every app, in one catalog: the
 * chips of the lesson payload (main's lesson page and the API's lesson) and the question the API
 * stores when one is tapped both read these words.
 */
async function wordTutorSuggestionLabels(
  language: string,
): Promise<Record<LessonScreenSuggestion, string>> {
  const t = await getExtracted({
    locale: isValidLocale(language) ? language : DEFAULT_LOCALE,
    namespace: "tutorSuggestions",
  });

  return {
    deeper: t("I want to go deeper"),
    example: t("Give me another example"),
    simpler: t("Explain it more simply"),
  };
}

/** The tutor's suggestions for a lesson's screens, as their chips read, in the lesson's language. */
export async function wordTutorSuggestions(language: string): Promise<LessonTutorSuggestion[]> {
  const words = await wordTutorSuggestionLabels(language);

  return [
    { id: "simpler", label: words.simpler },
    { id: "deeper", label: words.deeper },
    { id: "example", label: words.example },
  ];
}

/** A tapped suggestion as the learner's question: the same words its chip read. */
export async function wordTutorSuggestion({
  language,
  suggestion,
}: {
  language: string;
  suggestion: LessonScreenSuggestion;
}): Promise<string> {
  const words = await wordTutorSuggestionLabels(language);
  return words[suggestion];
}
