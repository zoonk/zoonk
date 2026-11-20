import { mockAnswerSchema } from "@zoonk/core/exams/mocks/answer-contract";
import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockDraft } from "@zoonk/core/exams/mocks/view-contract";
import { z } from "zod";
import { deviceStorage } from "../_utils/device-storage";

const unsentMockDraftSchema = z.object({
  answer: mockAnswerSchema.nullable(),
  durationMs: z.int().min(0),
  flagged: z.boolean(),
  itemId: z.string().min(1),
});

function getUnsentKey(blockId: string): string {
  return `mock:${blockId}`;
}

function isSameDraft(first: MockDraft, second: MockDraft | undefined): boolean {
  return (
    second !== undefined &&
    first.durationMs === second.durationMs &&
    first.flagged === second.flagged &&
    JSON.stringify(first.answer) === JSON.stringify(second.answer)
  );
}

/** Malformed entries are ignored so a corrupt value never blocks reopening the mock. */
export function readUnsentMockDrafts(blockId: string): MockDraft[] {
  const stored = deviceStorage.getJson(getUnsentKey(blockId));

  if (!Array.isArray(stored)) {
    return [];
  }

  return stored.flatMap((entry) => {
    const parsed = unsentMockDraftSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export function writeUnsentMockDrafts({
  blockId,
  drafts,
}: {
  blockId: string;
  drafts: readonly MockDraft[];
}) {
  if (drafts.length === 0) {
    deviceStorage.remove(getUnsentKey(blockId));
    return;
  }

  deviceStorage.set(getUnsentKey(blockId), JSON.stringify(drafts));
}

export function clearUnsentMockDrafts(blockId: string) {
  deviceStorage.remove(getUnsentKey(blockId));
}

export function combinePendingMockDrafts({
  pending,
  unsavedText,
}: {
  pending: readonly MockDraft[];
  unsavedText: MockDraft | null;
}): MockDraft[] {
  if (!unsavedText) {
    return [...pending];
  }

  const combined = [...pending];
  const index = combined.findIndex((draft) => draft.itemId === unsavedText.itemId);

  if (index === -1) {
    combined.push(unsavedText);
  } else {
    combined[index] = unsavedText;
  }

  return combined;
}

/** Kept answers that still belong to the section on screen and aren't already stored identically. */
export function selectKeptDraftsForView({
  kept,
  view,
}: {
  kept: readonly MockDraft[];
  view: MockView;
}): MockDraft[] {
  if (view.status !== "running" || !view.current) {
    return [];
  }

  const questionIds = new Set(view.current.questions.map((question) => question.itemId));
  const storedByItem = new Map(view.current.drafts.map((draft) => [draft.itemId, draft]));

  return kept.filter(
    (draft) => questionIds.has(draft.itemId) && !isSameDraft(draft, storedByItem.get(draft.itemId)),
  );
}
