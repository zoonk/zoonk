"use client";

import { getFromBrowser, postFromBrowser } from "@/lib/api/browser-api";
import { readRefusedLessonLimit } from "@/lib/api/refused-limit";
import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/error-codes";
import {
  type ChapterMindMapView,
  type GoalMindMapGenerations,
  type GoalMindMapsView,
  type MindMapStatus,
  type SaveMindMapInput,
  chapterMindMapSchema,
  chapterMindMapStatusSchema,
  goalMindMapGenerationsSchema,
  goalMindMapsSchema,
  savedMindMapStateSchema,
} from "@zoonk/core/mind-maps/contract";
import { type ChapterLessonMapsView } from "@zoonk/core/mind-maps/lesson-maps-contract";
import {
  type MindMapActions,
  type MindMapLibraryActions,
  type MindMapLimit,
  type MindMapRequestOutcome,
} from "@zoonk/learn/mind-maps";
import { type MindMapReaderActions } from "@zoonk/player/mind-maps/reader";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { useMemo } from "react";

const HTTP_UNPROCESSABLE = 422;

const LIMIT_RESOURCES = ["aiSpend", "generatedLessons", "lessonStart", "mindMap"] as const;

function goalPath(goalId: string) {
  return `/v1/goals/${encodeURIComponent(goalId)}` as const;
}

function chapterPath({ chapterId, goalId }: { chapterId: string; goalId: string }) {
  return `${goalPath(goalId)}/chapters/${encodeURIComponent(chapterId)}/mind-map` as const;
}

function getError(body: unknown) {
  return isJsonObject(body) && isJsonObject(body.error) ? body.error : null;
}

function readLimitResource(body: unknown): MindMapLimit["resource"] {
  const details = getError(body)?.details;
  const resource = getString(isJsonObject(details) ? details.limit : null, "resource");
  return LIMIT_RESOURCES.find((candidate) => candidate === resource);
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

  const limit = readRefusedLessonLimit({ body, status: response.status });

  if (limit) {
    return { limit: { ...limit, resource: readLimitResource(body) }, status: "refused" };
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

async function listMindMaps(goalId: string): Promise<GoalMindMapsView | null> {
  const response = await getFromBrowser(`${goalPath(goalId)}/mind-maps`);

  if (!response?.ok) {
    return null;
  }

  const json: unknown = await response.json().catch(() => null);
  return goalMindMapsSchema.safeParse(json).data ?? null;
}

async function requestAllMindMaps(goalId: string): Promise<GoalMindMapGenerations | null> {
  const response = await postFromBrowser({ path: `${goalPath(goalId)}/mind-maps/generations` });

  if (!response?.ok) {
    return null;
  }

  const json: unknown = await response.json().catch(() => null);
  return goalMindMapGenerationsSchema.safeParse(json).data ?? null;
}

async function saveMindMap({
  goalId,
  input,
}: {
  goalId: string;
  input: SaveMindMapInput;
}): Promise<boolean | null> {
  const response = await postFromBrowser({
    body: input,
    path: `${goalPath(goalId)}/mind-maps/saved`,
  });

  if (!response?.ok) {
    return null;
  }

  const json: unknown = await response.json().catch(() => null);
  return savedMindMapStateSchema.safeParse(json).data?.saved ?? null;
}

async function readLessonMaps(target: {
  chapterId: string;
  goalId: string;
}): Promise<ChapterLessonMapsView["lessons"] | null> {
  const chapter = encodeURIComponent(target.chapterId);
  const path = `${goalPath(target.goalId)}/chapters/${chapter}/lesson-maps` as const;
  const response = await getFromBrowser(path);

  if (!response?.ok) {
    return null;
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The API checks this answer against `ChapterLessonMaps`; that schema would bring every lesson schema into the browser.
  const body = (await response.json().catch(() => null)) as ChapterLessonMapsView | null;
  return body?.lessons ?? null;
}

/**
 * From the browser: making a map takes a minute, which would hold up the page's Server Actions, and
 * a save's Server Action would expire the learner's tags and render again the screen it's on, a
 * lesson's end included.
 */
export function useMindMapActions(
  goalId: string,
): MindMapActions & MindMapLibraryActions & MindMapReaderActions {
  return useMemo(
    () => ({
      lessonMaps: (chapterId) => readLessonMaps({ chapterId, goalId }),
      list: () => listMindMaps(goalId),
      read: (chapterId) => readMindMap({ chapterId, goalId }),
      readStatus: (chapterId) => readMindMapStatus({ chapterId, goalId }),
      request: (chapterId) => requestMindMap({ chapterId, goalId }),
      requestAll: () => requestAllMindMaps(goalId),
      save: (input) => saveMindMap({ goalId, input }),
    }),
    [goalId],
  );
}
