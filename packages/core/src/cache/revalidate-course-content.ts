import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { MAIN_URL } from "@zoonk/utils/url";
import { COURSE_CACHE_SECRET_HEADER, isCourseContentTag } from "./course-content-tags";
import { revalidateCacheTags } from "./revalidate-cache-tags";

const NOTIFICATION_TIMEOUT_MS = 2000;

/** Await after committing content, including inside durable steps with no response lifetime. */
export async function revalidateCourseContent(tags: readonly string[]): Promise<void> {
  revalidateCacheTags(tags);

  if (process.env.ZOONK_APP !== "api") {
    return;
  }

  const contentTags = [...new Set(tags)].filter((tag) => isCourseContentTag(tag));

  if (contentTags.length === 0) {
    return;
  }

  const { error } = await safeAsync(async () => {
    const secret = process.env.APP_CACHE_SECRET;

    if (!secret) {
      throw new Error("APP_CACHE_SECRET is missing");
    }

    const response = await fetch(new URL("/api/cache/tags", MAIN_URL), {
      body: JSON.stringify({ tags: contentTags }),
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
  });

  if (error) {
    logError("Main course cache notification failed", error.message);
  }
}
