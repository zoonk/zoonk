import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { MAIN_URL } from "@zoonk/utils/url";
import { COURSE_CACHE_SECRET_HEADER, isCourseContentTag } from "./course-content-tags";
import { revalidateCacheTags } from "./revalidate-cache-tags";

const NOTIFICATION_TIMEOUT_MS = 30_000;
const pendingTags = new AsyncLocalStorage<Set<string>>();

export type CourseContentWrite<T> = { tags: string[]; value: T };

/** A durable write returns its invalidations so delivery can retry without repeating the write. */
export async function collectCourseContentTags<T>(
  write: () => Promise<T>,
): Promise<CourseContentWrite<T>> {
  const tags = new Set<string>();
  const value = await pendingTags.run(tags, write);
  return { tags: [...tags], value };
}

/** Durable steps collect these tags and await their delivery from the workflow. */
export async function revalidateCourseContent(tags: readonly string[]): Promise<void> {
  revalidateCacheTags(tags);

  if (process.env.ZOONK_APP !== "api") {
    return;
  }

  const contentTags = [...new Set(tags)].filter((tag) => isCourseContentTag(tag));

  if (contentTags.length === 0) {
    return;
  }

  const pending = pendingTags.getStore();

  if (pending) {
    contentTags.forEach((tag) => pending.add(tag));
    return;
  }

  await notifyCourseContent(contentTags);
}

export async function notifyCourseContent(tags: readonly string[]): Promise<void> {
  const secret = process.env.APP_CACHE_SECRET;

  if (!secret) {
    throw new Error("APP_CACHE_SECRET is missing");
  }

  const response = await fetch(new URL("/api/cache/tags", MAIN_URL), {
    body: JSON.stringify({ tags }),
    cache: "no-store",
    headers: {
      [COURSE_CACHE_SECRET_HEADER]: secret,
      "content-type": "application/json",
      ...(process.env.MAIN_CACHE_BYPASS_SECRET && {
        "x-vercel-protection-bypass": process.env.MAIN_CACHE_BYPASS_SECRET,
      }),
    },
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(NOTIFICATION_TIMEOUT_MS),
  });

  await response.body?.cancel();

  if (!response.ok) {
    throw new Error(`Main cache notification returned ${response.status}`);
  }
}
