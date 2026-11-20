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

const storedMockDraftSchema = z.object({ draft: unsentMockDraftSchema, savedAt: z.int().min(0) });

let lastSavedAt = 0;

function nextSavedAt(): number {
  const now = Date.now();
  lastSavedAt = now > lastSavedAt ? now : lastSavedAt + 1;
  return lastSavedAt;
}

function getPrefix(blockId: string): string {
  return `mock:${blockId}:`;
}

function getDraftKey({ blockId, itemId }: { blockId: string; itemId: string }): string {
  return `${getPrefix(blockId)}${itemId}`;
}

function isSameDraft(first: MockDraft, second: MockDraft | undefined): boolean {
  return (
    second !== undefined &&
    first.durationMs === second.durationMs &&
    first.flagged === second.flagged &&
    JSON.stringify(first.answer) === JSON.stringify(second.answer)
  );
}

/** One key per question avoids cross-tab read-modify-write races on a shared array. */
export function keepUnsentMockDraft({ blockId, draft }: { blockId: string; draft: MockDraft }) {
  const key = getDraftKey({ blockId, itemId: draft.itemId });
  const existing = storedMockDraftSchema.safeParse(deviceStorage.getJson(key));
  const savedAt = existing.success ? existing.data.savedAt : nextSavedAt();

  deviceStorage.set(key, JSON.stringify({ draft, savedAt }));
}

/** Removes the question's entry only if storage still holds this exact version. */
export function dropUnsentMockDraft({ blockId, draft }: { blockId: string; draft: MockDraft }) {
  const key = getDraftKey({ blockId, itemId: draft.itemId });
  const parsed = storedMockDraftSchema.safeParse(deviceStorage.getJson(key));

  if (parsed.success && isSameDraft(parsed.data.draft, draft)) {
    deviceStorage.remove(key);
  }
}

function clearUnsentMockDrafts(blockId: string) {
  for (const key of deviceStorage.keys(getPrefix(blockId))) {
    deviceStorage.remove(key);
  }
}

/**
 * Returns unsent drafts for the current section (oldest first) that differ from `storedDrafts`,
 * removing only already-stored copies for this section. Terminal states clear the mock's keys.
 */
export function restoreUnsentMockDrafts({
  blockId,
  storedDrafts,
  view,
}: {
  blockId: string;
  storedDrafts?: Readonly<Record<string, MockDraft>>;
  view: MockView;
}): MockDraft[] {
  if (view.status === "finished" || view.status === "expired") {
    clearUnsentMockDrafts(blockId);
    return [];
  }

  if (view.status !== "running" || !view.current) {
    return [];
  }

  const questionIndex = new Map(
    view.current.questions.map((question, index) => [question.itemId, index]),
  );

  const storedByItem = storedDrafts
    ? new Map(Object.entries(storedDrafts))
    : new Map(view.current.drafts.map((draft) => [draft.itemId, draft]));

  const entries = deviceStorage
    .keys(getPrefix(blockId))
    .flatMap((key) => {
      const parsed = storedMockDraftSchema.safeParse(deviceStorage.getJson(key));
      return parsed.success ? [{ ...parsed.data, key }] : [];
    })
    .toSorted(
      (first, second) =>
        first.savedAt - second.savedAt ||
        (questionIndex.get(first.draft.itemId) ?? 0) -
          (questionIndex.get(second.draft.itemId) ?? 0),
    );

  const kept: MockDraft[] = [];

  for (const entry of entries) {
    if (questionIndex.has(entry.draft.itemId)) {
      if (isSameDraft(entry.draft, storedByItem.get(entry.draft.itemId))) {
        deviceStorage.remove(entry.key);
      } else {
        kept.push(entry.draft);
      }
    }
  }

  return kept;
}

/** Drops entries belonging to a section that was just handed in, or clears a finished/expired mock. */
export function clearHandedInMockDrafts({
  blockId,
  next,
  previous,
}: {
  blockId: string;
  next: MockView;
  previous: MockView;
}) {
  if (next.status === "finished" || next.status === "expired") {
    clearUnsentMockDrafts(blockId);
    return;
  }

  for (const question of previous.current?.questions ?? []) {
    deviceStorage.remove(getDraftKey({ blockId, itemId: question.itemId }));
  }
}

/** Furthest question index reached by recovered drafts in a forward-only section, or -1. */
export function getForwardOnlyKeptReached({
  kept,
  view,
}: {
  kept: readonly MockDraft[];
  view: MockView;
}): number {
  const forwardOnly =
    view.sections.find((section) => section.status === "current")?.navigation?.forwardOnly ?? false;

  if (!forwardOnly || !view.current) {
    return -1;
  }

  return Math.max(
    -1,
    ...kept.map(
      (draft) => view.current?.questions.findIndex((item) => item.itemId === draft.itemId) ?? -1,
    ),
  );
}
