"use server";

import {
  type MemoryChange,
  type MemoryChangeReference,
  type MemoryExport,
  memoryFactUpdateSchema,
  memorySettingsUpdateSchema,
  memoryUndoInputSchema,
} from "@zoonk/core/memory/contract";
import { deleteMemoryFact } from "@zoonk/core/memory/delete-fact";
import { exportCurrentUserMemory } from "@zoonk/core/memory/export";
import { updateMemorySettings } from "@zoonk/core/memory/settings";
import { undoMemoryChanges } from "@zoonk/core/memory/undo";
import { updateMemoryFact } from "@zoonk/core/memory/update-fact";

export async function setMemoryEnabledAction(enabled: boolean): Promise<boolean> {
  const parsed = memorySettingsUpdateSchema.safeParse({ enabled });

  if (!parsed.success) {
    return false;
  }

  const result = await updateMemorySettings(parsed.data);
  return result.status === "updated";
}

export async function updateMemoryFactAction({
  factId,
  statement,
}: {
  factId: string;
  statement: string;
}): Promise<boolean> {
  const parsed = memoryFactUpdateSchema.safeParse({ statement });

  if (!parsed.success) {
    return false;
  }

  const result = await updateMemoryFact({ factId, input: parsed.data });
  return result.status === "updated";
}

export async function deleteMemoryFactAction(factId: string): Promise<MemoryChange | null> {
  const result = await deleteMemoryFact(factId);
  return result.status === "deleted" ? result.change : null;
}

export async function undoMemoryChangesAction(changes: MemoryChangeReference[]): Promise<boolean> {
  const parsed = memoryUndoInputSchema.safeParse({ changes });

  if (!parsed.success) {
    return false;
  }

  const result = await undoMemoryChanges(parsed.data);
  return result.status === "undone";
}

export async function exportMemoryAction(): Promise<MemoryExport | null> {
  return exportCurrentUserMemory();
}
