"use client";

import { type MemoryView } from "@zoonk/core/memory/contract";
import { type MemoryActions, MemoryScreen } from "@zoonk/learn/memory";
import {
  deleteMemoryFactAction,
  exportMemoryAction,
  setMemoryEnabledAction,
  undoMemoryChangesAction,
  updateMemoryFactAction,
} from "./actions";

export function MemorySettings({ memory }: { memory: MemoryView }) {
  const actions: MemoryActions = {
    deleteFact: deleteMemoryFactAction,
    exportMemory: exportMemoryAction,
    setEnabled: setMemoryEnabledAction,
    undo: undoMemoryChangesAction,
    updateFact: updateMemoryFactAction,
  };

  return <MemoryScreen actions={actions} memory={memory} />;
}
