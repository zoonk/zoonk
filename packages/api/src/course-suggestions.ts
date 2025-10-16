import "server-only";

import { generateCourseSuggestions } from "@zoonk/ai/course-suggestions";
import {
  addCourseSuggestion,
  getCourseSuggestion,
  type Suggestion,
} from "@zoonk/db/queries/course-suggestions";
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache";

const model = process.env.AI_MODEL_COURSE_SUGGESTIONS || "openai/gpt-4.1";

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
    const { data } = await generateCourseSuggestions({
      locale,
      prompt,
      model,
    });

    await addCourseSuggestion({ locale, prompt, suggestions: data });

    return data;
  }

  return record.suggestions as Suggestion[];
}
