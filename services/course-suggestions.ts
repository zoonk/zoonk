import "server-only";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { getCourseSuggestion, type Suggestion } from "@/db/course-suggestions";

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
    return [];
  }

  return record.suggestions as Suggestion[];
}
