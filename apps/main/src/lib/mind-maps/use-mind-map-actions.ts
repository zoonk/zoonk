"use client";

import { getFromBrowser, postFromBrowser } from "@/lib/api/browser-api";
import { readRefusedLimit } from "@/lib/api/refused-limit";
import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/error-codes";
import {
  type ChapterMindMapView,
  type MindMapStatus,
  chapterMindMapSchema,
  chapterMindMapStatusSchema,
} from "@zoonk/core/mind-maps/contract";
import { type MindMapActions, type MindMapRequestOutcome } from "@zoonk/learn/mind-maps";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { useMemo } from "react";

const HTTP_UNPROCESSABLE = 422;

const LESSON_RESOURCES = new Set(["generatedLessons", "lessonStart"]);

function chapterPath({ chapterId, goalId }: { chapterId: string; goalId: string }) {
  return `/v1/goals/${encodeURIComponent(goalId)}/chapters/${encodeURIComponent(chapterId)}/mind-map` as const;
}

function getError(body: unknown) {
  return isJsonObject(body) && isJsonObject(body.error) ? body.error : null;
}

/** The map is refused when the lessons it writes first ran out, not only the maps. */
function ranOutOfLessons(body: unknown): boolean {
  const details = getError(body)?.details;
  const limit = isJsonObject(details) ? details.limit : null;
  return LESSON_RESOURCES.has(getString(limit, "resource") ?? "");
}

async function requestMindMap(target: {
  chapterId: string;
  goalId: string;
}): Promise<MindMapRequestOutcome> {
  const response = await postFromBrowser({ path: `${chapterPath(target)}/generations` });

  if (!response) {
    return { status: "failed" };
  }

  const body: unknown = await response.json().catch(() => null);

  if (getString(getError(body), "code") === LESSON_PLAYER_ERROR_CODES.plusRequired) {
    return { status: "plusRequired" };
  }

  const limit = readRefusedLimit({ body, status: response.status });

  if (limit) {
    return { limit: { ...limit, lessons: ranOutOfLessons(body) }, status: "refused" };
  }

  if (response.status === HTTP_UNPROCESSABLE) {
    return { status: "unavailable" };
  }

  const status = response.ok ? getString(body, "status") : null;

  if (status === "ready" || status === "writingLessons" || status === "drawing") {
    return { status };
  }

  return { status: "failed" };
}

async function readMindMap(target: {
  chapterId: string;
  goalId: string;
}): Promise<ChapterMindMapView | null> {
  const response = await getFromBrowser(chapterPath(target));

  if (!response?.ok) {
    return null;
  }

  const json: unknown = await response.json().catch(() => null);
  return chapterMindMapSchema.safeParse(json).data ?? null;
}

async function readMindMapStatus(target: {
  chapterId: string;
  goalId: string;
}): Promise<MindMapStatus | null> {
  const response = await getFromBrowser(`${chapterPath(target)}/status`);

  if (!response?.ok) {
    return null;
  }

  const json: unknown = await response.json().catch(() => null);
  return chapterMindMapStatusSchema.safeParse(json).data?.status ?? null;
}

/** From the browser: making a map takes a minute, which would hold up the page's Server Actions. */
export function useMindMapActions(goalId: string): MindMapActions {
  return useMemo(
    () => ({
      read: (chapterId) => readMindMap({ chapterId, goalId }),
      readStatus: (chapterId) => readMindMapStatus({ chapterId, goalId }),
      request: (chapterId) => requestMindMap({ chapterId, goalId }),
    }),
    [goalId],
  );
}
