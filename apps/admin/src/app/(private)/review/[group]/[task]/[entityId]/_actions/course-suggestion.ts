"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { toSlug } from "@zoonk/utils/string";
import { revalidatePath } from "next/cache";

type CourseSuggestionMoveDirection = "up" | "down";
type PositionUpdate = { id: string; position: number };

const COURSE_SUGGESTION_LINK_ORDER = [
  { position: "asc" as const },
  { createdAt: "asc" as const },
  { id: "asc" as const },
];

/**
 * Reordering is submitted from plain HTML forms, so the server action must
 * reject anything outside the two movements the UI exposes.
 */
function parseMoveDirection(value: string | null): CourseSuggestionMoveDirection | null {
  if (value === "up" || value === "down") {
    return value;
  }

  return null;
}

/**
 * Boundary moves should keep the current order instead of throwing. That lets
 * stale forms remain harmless when another admin has already moved an item.
 */
function getAdjacentIndex({
  currentIndex,
  direction,
  itemCount,
}: {
  currentIndex: number;
  direction: CourseSuggestionMoveDirection;
  itemCount: number;
}): number | null {
  if (currentIndex === -1) {
    return null;
  }

  if (direction === "up" && currentIndex > 0) {
    return currentIndex - 1;
  }

  if (direction === "down" && currentIndex < itemCount - 1) {
    return currentIndex + 1;
  }

  return null;
}

/**
 * The database stores numeric positions, but the UI operation is "swap this
 * item with its neighbor". Keeping that rule pure makes the transaction only
 * responsible for reading and writing the final order.
 */
function moveIdByDirection({
  currentId,
  direction,
  ids,
}: {
  currentId: string;
  direction: CourseSuggestionMoveDirection;
  ids: string[];
}): string[] {
  const currentIndex = ids.indexOf(currentId);
  const adjacentIndex = getAdjacentIndex({ currentIndex, direction, itemCount: ids.length });

  if (adjacentIndex === null) {
    return ids;
  }

  return ids.map((id, index) =>
    getMovedIdAtIndex({ adjacentIndex, currentIndex, fallbackId: id, ids, index }),
  );
}

/**
 * The swap helper keeps branching out of the array callback and makes each
 * index rule explicit: current takes neighbor, neighbor takes current, the
 * rest keep their existing IDs.
 */
function getMovedIdAtIndex({
  adjacentIndex,
  currentIndex,
  fallbackId,
  ids,
  index,
}: {
  adjacentIndex: number;
  currentIndex: number;
  fallbackId: string;
  ids: string[];
  index: number;
}): string {
  if (index === currentIndex) {
    return ids[adjacentIndex] ?? fallbackId;
  }

  if (index === adjacentIndex) {
    return ids[currentIndex] ?? fallbackId;
  }

  return fallbackId;
}

/**
 * After any reorder, positions are rewritten from zero so older gaps or
 * duplicate positions cannot keep affecting future review order.
 */
function buildPositionUpdates(ids: string[]): PositionUpdate[] {
  return ids.map((id, position) => ({ id, position }));
}

/**
 * SearchPromptSuggestion has no unique position constraint, so updating every
 * row to its normalized position is the simplest reliable reorder operation.
 */
async function updateSearchPromptSuggestionPositions({
  tx,
  updates,
}: {
  tx: TransactionClient;
  updates: PositionUpdate[];
}) {
  await Promise.all(
    updates.map((update) =>
      tx.searchPromptSuggestion.update({
        data: { position: update.position },
        where: { id: update.id },
      }),
    ),
  );
}

/**
 * Sorting belongs to the prompt-suggestion link, not the reusable course
 * suggestion record, because the same suggestion can appear under many prompts.
 */
async function moveSearchPromptSuggestion({
  courseSuggestionId,
  direction,
  searchPromptId,
  tx,
}: {
  courseSuggestionId: string;
  direction: CourseSuggestionMoveDirection;
  searchPromptId: string;
  tx: TransactionClient;
}) {
  const links = await tx.searchPromptSuggestion.findMany({
    orderBy: COURSE_SUGGESTION_LINK_ORDER,
    where: { searchPromptId },
  });

  const currentLink = links.find((link) => link.courseSuggestionId === courseSuggestionId);

  if (!currentLink) {
    return;
  }

  const sortedIds = moveIdByDirection({
    currentId: currentLink.id,
    direction,
    ids: links.map((link) => link.id),
  });

  await updateSearchPromptSuggestionPositions({ tx, updates: buildPositionUpdates(sortedIds) });
}

export async function updateCourseSuggestionAction(formData: FormData) {
  await assertAdmin();

  const suggestionId = parseFormField(formData, "suggestionId");
  const title = parseFormField(formData, "title");
  const description = parseFormField(formData, "description");

  if (!suggestionId || !title || !description) {
    throw new Error("Invalid form data");
  }

  const { error } = await safeAsync(() =>
    prisma.courseSuggestion.update({
      data: { description, slug: toSlug(title), title },
      where: { id: suggestionId },
    }),
  );

  if (error) {
    throw error;
  }

  revalidatePath("/review");
}

export async function removeCourseSuggestionAction(formData: FormData) {
  await assertAdmin();

  const searchPromptId = parseFormField(formData, "searchPromptId");
  const courseSuggestionId = parseFormField(formData, "courseSuggestionId");

  if (!searchPromptId || !courseSuggestionId) {
    throw new Error("Invalid form data");
  }

  const { error } = await safeAsync(() =>
    prisma.searchPromptSuggestion.delete({
      where: { promptSuggestion: { courseSuggestionId, searchPromptId } },
    }),
  );

  if (error) {
    throw error;
  }

  revalidatePath("/review");
}

export async function addCourseSuggestionAction(formData: FormData) {
  await assertAdmin();

  const searchPromptId = parseFormField(formData, "searchPromptId");
  const title = parseFormField(formData, "title");
  const description = parseFormField(formData, "description");
  const language = parseFormField(formData, "language");
  const targetLanguage = parseFormField(formData, "targetLanguage");

  if (!searchPromptId || !title || !description || !language) {
    throw new Error("Invalid form data");
  }

  const { error } = await safeAsync(async () => {
    const slug = toSlug(title);

    await prisma.$transaction(async (tx) => {
      const suggestion = await tx.courseSuggestion.upsert({
        create: { description, language, slug, targetLanguage: targetLanguage || null, title },
        update: { description, title },
        where: { languageSlug: { language, slug } },
      });

      await tx.searchPromptSuggestion.updateMany({
        data: { position: { increment: 1 } },
        where: { searchPromptId },
      });

      await tx.searchPromptSuggestion.upsert({
        create: { courseSuggestionId: suggestion.id, position: 0, searchPromptId },
        update: { position: 0 },
        where: { promptSuggestion: { courseSuggestionId: suggestion.id, searchPromptId } },
      });
    });
  });

  if (error) {
    throw error;
  }

  revalidatePath("/review");
}

export async function moveCourseSuggestionAction(formData: FormData) {
  await assertAdmin();

  const searchPromptId = parseFormField(formData, "searchPromptId");
  const courseSuggestionId = parseFormField(formData, "courseSuggestionId");
  const direction = parseMoveDirection(parseFormField(formData, "direction"));

  if (!searchPromptId || !courseSuggestionId || !direction) {
    throw new Error("Invalid form data");
  }

  const { error } = await safeAsync(() =>
    prisma.$transaction((tx) =>
      moveSearchPromptSuggestion({ courseSuggestionId, direction, searchPromptId, tx }),
    ),
  );

  if (error) {
    throw error;
  }

  revalidatePath("/review");
}
