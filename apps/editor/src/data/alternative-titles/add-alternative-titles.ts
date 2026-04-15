import "server-only";
import { addAlternativeTitles as createAlternativeTitles } from "@zoonk/core/alternative-titles/add";
import { type BatchPayload } from "@zoonk/db";
import { type SafeReturn } from "@zoonk/utils/error";
import { getAuthorizedAlternativeTitleCourse } from "./get-authorized-course";

/**
 * The editor needs an authenticated wrapper around the shared alternative-title
 * insert helper so every mutation reuses the same org-level permission check.
 */
export async function addAlternativeTitles(params: {
  courseId: number;
  headers?: Headers;
  language: string;
  titles: string[];
}): Promise<SafeReturn<BatchPayload | null>> {
  const { error } = await getAuthorizedAlternativeTitleCourse({
    courseId: params.courseId,
    headers: params.headers,
  });

  if (error) {
    return { data: null, error };
  }

  return createAlternativeTitles({
    courseId: params.courseId,
    language: params.language,
    titles: params.titles,
  });
}
