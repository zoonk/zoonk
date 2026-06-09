"use client";

import { useCatalogGridContext } from "@/components/catalog/catalog-grid-context";
import { GridItemPosition, type GridItemTone } from "@zoonk/ui/components/grid";

/**
 * Lesson filters hide rows on the client, so the visible position badge needs
 * to read the current catalog filter instead of using the database position.
 * This keeps a filtered list numbered 1, 2, 3 even when hidden lessons sit
 * between the visible lessons in the original chapter order.
 */
export function LessonListPosition({
  lessonId,
  position,
  tone,
}: {
  lessonId: string;
  position: number;
  tone: GridItemTone;
}) {
  const context = useCatalogGridContext();

  const lessonNumber = getVisibleLessonNumber({
    filteredIds: context?.filteredIds ?? null,
    lessonId,
    position,
  });

  return <GridItemPosition tone={tone}>{lessonNumber}</GridItemPosition>;
}

/**
 * The server-rendered map still includes every lesson, but the client filter
 * exposes the visible ids in display order. The original position remains the
 * fallback for the unfiltered state and for defensive cases where the tile is
 * rendered before the filter context is ready.
 */
function getVisibleLessonNumber({
  filteredIds,
  lessonId,
  position,
}: {
  filteredIds: Set<string> | null;
  lessonId: string;
  position: number;
}) {
  if (!filteredIds) {
    return position;
  }

  const visibleIndex = [...filteredIds].indexOf(lessonId);

  if (visibleIndex === -1) {
    return position;
  }

  return visibleIndex + 1;
}
