import "server-only";
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache";
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
  cacheTag(locale, prompt);

  const record = await getCourseSuggestion({ locale, prompt });

  if (!record) {
    const { courses } = await generateCourseSuggestions({ locale, prompt });
    await addCourseSuggestion({ locale, prompt, suggestions: courses });

    return courses;
  }

  return record.suggestions as Suggestion[];
}
