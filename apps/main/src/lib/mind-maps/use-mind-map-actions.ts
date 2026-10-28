"use client";

import { useRouter } from "@/i18n/navigation";
import { getFromBrowser, postFromBrowser } from "@/lib/api/browser-api";
import { readRefusedLimit } from "@/lib/api/refused-limit";
import { type MindMapStatus } from "@zoonk/core/mind-maps/contract";
import { type MindMapActions, type MindMapRequestOutcome } from "@zoonk/learn/mind-maps";
import { getString } from "@zoonk/utils/json";
import { useMemo } from "react";

const HTTP_UNPROCESSABLE = 422;
const STATUSES = new Set<string>(["available", "failed", "generating", "ready", "unavailable"]);

function isMindMapStatus(value: string | null): value is MindMapStatus {
  return value !== null && STATUSES.has(value);
}

function chapterPath({ chapterId, goalId }: { chapterId: string; goalId: string }) {
  return `/v1/goals/${encodeURIComponent(goalId)}/chapters/${encodeURIComponent(chapterId)}/mind-map` as const;
}

async function requestMindMap({
  chapterId,
  goalId,
}: {
  chapterId: string;
  goalId: string;
}): Promise<MindMapRequestOutcome> {
  const response = await postFromBrowser({
    path: `${chapterPath({ chapterId, goalId })}/generations`,
  });

  if (!response) {
    return { status: "failed" };
  }

  const body: unknown = await response.json().catch(() => null);
  const limit = readRefusedLimit({ body, status: response.status });

  if (limit) {
    return { limit, status: "refused" };
  }

  if (response.status === HTTP_UNPROCESSABLE) {
    return { status: "unavailable" };
  }

  if (!response.ok) {
    return { status: "failed" };
  }

  return getString(body, "status") === "ready" ? { status: "ready" } : { status: "generating" };
}

async function readMindMapStatus({
  chapterId,
  goalId,
}: {
  chapterId: string;
  goalId: string;
}): Promise<MindMapStatus | null> {
  const response = await getFromBrowser(`${chapterPath({ chapterId, goalId })}/status`);

  if (!response?.ok) {
    return null;
  }

  const status = getString(await response.json().catch(() => null), "status");
  return isMindMapStatus(status) ? status : null;
}

/** From the browser: making a map takes a minute, which would hold up the page's Server Actions. */
export function useMindMapActions(goalId: string): MindMapActions {
  const router = useRouter();

  return useMemo(
    () => ({
      readStatus: (chapterId) => readMindMapStatus({ chapterId, goalId }),
      refresh: () => router.refresh(),
      request: (chapterId) => requestMindMap({ chapterId, goalId }),
    }),
    [goalId, router],
  );
}
