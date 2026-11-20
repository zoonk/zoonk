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

function writeRaw({ blockId, drafts }: { blockId: string; drafts: readonly MockDraft[] }) {
  if (drafts.length === 0) {
    deviceStorage.remove(getUnsentKey(blockId));
    return;
  }

  deviceStorage.set(getUnsentKey(blockId), JSON.stringify(drafts));
}

/** Malformed entries are ignored so a corrupt value never blocks reopening the mock. */
function readUnsentMockDrafts(blockId: string): MockDraft[] {
  const stored = deviceStorage.getJson(getUnsentKey(blockId));

  if (!Array.isArray(stored)) {
    return [];
  }

  return stored.flatMap((entry) => {
    const parsed = unsentMockDraftSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

/**
 * Re-reads storage before updating one question's entry, so two open tabs for the same mock never
 * overwrite each other's unsent answers.
 */
export function keepUnsentMockDraft({ blockId, draft }: { blockId: string; draft: MockDraft }) {
  const current = readUnsentMockDrafts(blockId);
  const index = current.findIndex((entry) => entry.itemId === draft.itemId);

  if (index === -1) {
    current.push(draft);
  } else {
    current[index] = draft;
  }

  writeRaw({ blockId, drafts: current });
}

/** Removes an entry only if storage still holds this exact version, keeping any newer edit. */
export function dropUnsentMockDraft({ blockId, draft }: { blockId: string; draft: MockDraft }) {
  const current = readUnsentMockDrafts(blockId);

  const next = current.filter(
    (entry) => !(entry.itemId === draft.itemId && isSameDraft(entry, draft)),
  );

  if (next.length !== current.length) {
    writeRaw({ blockId, drafts: next });
  }
}

function clearUnsentMockDrafts(blockId: string) {
  deviceStorage.remove(getUnsentKey(blockId));
}

/** Kept answers that still belong to the section on screen and aren't already stored identically. */
function selectKeptDraftsForView({
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

/** Drops entries that belong to finished/expired mocks or older sections, returning what remains. */
export function pruneUnsentMockDrafts({
  blockId,
  view,
}: {
  blockId: string;
  view: MockView;
}): MockDraft[] {
  if (view.status === "finished" || view.status === "expired") {
    clearUnsentMockDrafts(blockId);
    return [];
  }

  if (view.status !== "running") {
    return [];
  }

  const kept = readUnsentMockDrafts(blockId);
  const keptHere = selectKeptDraftsForView({ kept, view });

  if (kept.length !== keptHere.length) {
    writeRaw({ blockId, drafts: keptHere });
  }

  return keptHere;
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
