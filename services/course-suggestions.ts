import "server-only";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { generateCourseSuggestions } from "@/ai/course-suggestions";
import {
  addCourseSuggestion,
  getCourseSuggestion,
  type Suggestion,
} from "@/db/course-suggestions";

export async function fetchCourseSuggestions({
  locale,
  prompt,
}: {
  locale: string;
  prompt: string;
}): Promise<Suggestion[]> {
  "use cache";
  cacheLife("max");

  const record = await getCourseSuggestion({ locale, prompt });

  if (!record) {
    const suggestions = await generateCourseSuggestions({ locale, prompt });
    await addCourseSuggestion({ locale, prompt, suggestions });

    return suggestions;
  }

  return record.suggestions as Suggestion[];
}
