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

const storedMockDraftSchema = z.object({ draft: unsentMockDraftSchema, keptAt: z.int().min(0) });

let lastKeptAt = 0;

function nextKeptAt(): number {
  const now = Date.now();
  lastKeptAt = now > lastKeptAt ? now : lastKeptAt + 1;
  return lastKeptAt;
}

function getPrefix(blockId: string): string {
  return `mock:${blockId}:`;
}

function getDraftKey({ blockId, itemId }: { blockId: string; itemId: string }): string {
  return `${getPrefix(blockId)}${itemId}`;
}

function isSameDraft(first: MockDraft, second: MockDraft): boolean {
  return (
    first.durationMs === second.durationMs &&
    first.flagged === second.flagged &&
    JSON.stringify(first.answer) === JSON.stringify(second.answer)
  );
}

/** One key per question avoids cross-tab read-modify-write races on a shared array. */
export function keepUnsentMockDraft({ blockId, draft }: { blockId: string; draft: MockDraft }) {
  const key = getDraftKey({ blockId, itemId: draft.itemId });
  const existing = storedMockDraftSchema.safeParse(deviceStorage.getJson(key));
  const keptAt = existing.success ? existing.data.keptAt : nextKeptAt();

  deviceStorage.set(key, JSON.stringify({ draft, keptAt }));
}

/** Removes the question's entry only if storage still holds this exact version. */
export function dropUnsentMockDraft({ blockId, draft }: { blockId: string; draft: MockDraft }) {
  const key = getDraftKey({ blockId, itemId: draft.itemId });
  const parsed = storedMockDraftSchema.safeParse(deviceStorage.getJson(key));

  if (parsed.success && isSameDraft(parsed.data.draft, draft)) {
    deviceStorage.remove(key);
  }
}

/** The current section's kept answers in the order first kept; a finished mock keeps none. */
export function restoreUnsentMockDrafts({
  blockId,
  view,
}: {
  blockId: string;
  view: MockView;
}): MockDraft[] {
  const keys = deviceStorage.keys(getPrefix(blockId));

  if (view.status === "finished" || view.status === "expired") {
    keys.forEach((key) => deviceStorage.remove(key));
    return [];
  }

  const questions = view.current?.questions.map((question) => question.itemId) ?? [];

  return keys
    .flatMap((key) => {
      const parsed = storedMockDraftSchema.safeParse(deviceStorage.getJson(key));
      return parsed.success && questions.includes(parsed.data.draft.itemId) ? [parsed.data] : [];
    })
    .toSorted((first, second) => first.keptAt - second.keptAt)
    .map((entry) => entry.draft);
}

/** A handed-in section's answers can't be saved again. */
export function clearHandedInMockDrafts({
  blockId,
  next,
  previous,
}: {
  blockId: string;
  next: MockView;
  previous: MockView;
}) {
  if (previous.current?.section === next.current?.section) {
    return;
  }

  for (const question of previous.current?.questions ?? []) {
    deviceStorage.remove(getDraftKey({ blockId, itemId: question.itemId }));
  }
}
