import {
  type LessonScreenSuggestion,
  type LessonTutorSuggestion,
} from "@zoonk/core/lesson-questions/contract";
import { DEFAULT_LOCALE, isValidLocale } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";

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

export async function wordTutorSuggestions(language: string): Promise<LessonTutorSuggestion[]> {
  const words = await wordTutorSuggestionLabels(language);

  return [
    { id: "simpler", label: words.simpler },
    { id: "deeper", label: words.deeper },
    { id: "example", label: words.example },
  ];
}

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
