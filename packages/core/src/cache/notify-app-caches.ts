import "server-only";
import { setTimeout } from "node:timers/promises";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import {
  APP_CACHE_SECRET_HEADER,
  MAX_APP_CACHE_TAGS,
  appCacheTagSchema,
  appCacheTagsSchema,
} from "./app-cache-contract";

const ATTEMPTS = 3;
const MAX_LOG_TAG_LENGTH = 256;
const REQUEST_TIMEOUT_MS = 2000;
const CLIENT_ERROR_START = 400;
const SERVER_ERROR_START = 500;
const TOO_MANY_REQUESTS = 429;

function isValidNotificationTag(tag: string): boolean {
  if (appCacheTagSchema.safeParse(tag).success) {
    return true;
  }

  /** Escape control characters and bound the log; never include request headers or configuration. */
  logError(
    "Rejected Main cache notification tag",
    JSON.stringify(tag.slice(0, MAX_LOG_TAG_LENGTH)),
  );

  return false;
}

async function sendBatch({
  secret,
  tags,
  url,
}: {
  secret: string;
  tags: readonly string[];
  url: URL;
}): Promise<void> {
  const body = JSON.stringify(appCacheTagsSchema.parse({ tags }));

  for (const attempt of Array.from({ length: ATTEMPTS }, (_, index) => index)) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Retry only after the preceding request fails.
    const { data, error } = await safeAsync(async () => {
      const response = await fetch(url, {
        body,
        headers: { [APP_CACHE_SECRET_HEADER]: secret, "content-type": "application/json" },
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      await response.body?.cancel();
      return { ok: response.ok, status: response.status };
    });

    if (data?.ok) {
      return;
    }

    if (
      attempt === ATTEMPTS - 1 ||
      (data !== null &&
        data.status >= CLIENT_ERROR_START &&
        data.status < SERVER_ERROR_START &&
        data.status !== TOO_MANY_REQUESTS)
    ) {
      throw new Error(
        `Main cache notification failed (${data?.status ?? error?.name ?? "network"})`,
      );
    }

    // oxlint-disable-next-line eslint/no-await-in-loop -- Backoff precedes the next retry.
    await setTimeout(100 * (attempt + 1));
  }
}

async function send(tags: readonly string[]): Promise<void> {
  const mainURL = process.env.MAIN_CACHE_URL;
  const secret = process.env.APP_CACHE_SECRET;

  if (!mainURL && !secret) {
    return;
  }

  if (!mainURL || !secret) {
    throw new Error("Main cache notifications require MAIN_CACHE_URL and APP_CACHE_SECRET");
  }

  const url = new URL("/api/cache/tags", mainURL);
  const uniqueTags = [...new Set(tags)].filter((tag) => isValidNotificationTag(tag));

  for (let start = 0; start < uniqueTags.length; start += MAX_APP_CACHE_TAGS) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Limit delivery concurrency; a failed batch never blocks later batches.
    const { error } = await safeAsync(() =>
      sendBatch({ secret, tags: uniqueTags.slice(start, start + MAX_APP_CACHE_TAGS), url }),
    );

    if (error) {
      logError("Main cache notification failed", error.message);
    }
  }
}

/**
 * Delivers committed content changes to Main's app-specific cache. The central invalidation hook
 * schedules this after the response; other server callers can await it after their commit.
 */
export async function notifyAppCaches(tags: readonly string[]): Promise<void> {
  if (tags.length === 0) {
    return;
  }

  const { error } = await safeAsync(() => send(tags));

  if (error) {
    logError("Main cache notification failed", error.message);
  }
}
