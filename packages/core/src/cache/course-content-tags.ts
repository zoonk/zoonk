import { z } from "zod";
import { COURSE_LIST_CACHE_TAG } from "./tags";

const MAX_CACHE_TAG_LENGTH = 256;

export const COURSE_CACHE_SECRET_HEADER = "x-app-cache-secret";

export function isCourseContentTag(tag: string): boolean {
  return (
    tag === COURSE_LIST_CACHE_TAG ||
    /^(?:course|course-curriculum):[a-zA-Z0-9-]+$/u.test(tag) ||
    /^course-route:[a-f0-9]{64}$/u.test(tag)
  );
}

export const courseContentTagsSchema = z.object({
  tags: z.array(z.string().max(MAX_CACHE_TAG_LENGTH).refine(isCourseContentTag)).min(1),
});
