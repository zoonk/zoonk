"use client";

import { trackEvent } from "@zoonk/core/analytics/client";
import { type MemoryView } from "@zoonk/core/memory/contract";
import { type MemoryActions, MemoryScreen } from "@zoonk/learn/memory";
import {
  deleteMemoryFactAction,
  exportMemoryAction,
  setMemoryEnabledAction,
  undoMemoryChangesAction,
  updateMemoryFactAction,
} from "./actions";

type MemoryChangeKind = "deleted" | "updated";

/** Counts what learners change in their memory, to see which facts they correct or remove. */
function trackFactChange({
  change,
  factId,
  memory,
}: {
  change: MemoryChangeKind;
  factId: string;
  memory: MemoryView;
}) {
  const fact = memory.facts.find((item) => item.id === factId);

  if (fact) {
    trackEvent({
      name: "Memory Updated",
      properties: { category: fact.category, change, origin: fact.origin },
    });
  }
}

/** The Memory screen with main's actions. */
export function MemorySettings({ memory }: { memory: MemoryView }) {
  const actions: MemoryActions = {
    deleteFact: async (factId) => {
      const change = await deleteMemoryFactAction(factId);

      if (change) {
        trackFactChange({ change: "deleted", factId, memory });
      }

      return change;
    },
    exportMemory: exportMemoryAction,
    setEnabled: async (enabled) => {
      const saved = await setMemoryEnabledAction(enabled);

      if (saved && !enabled) {
        trackEvent({ name: "Memory Turned Off" });
      }

      return saved;
    },
    undo: undoMemoryChangesAction,
    updateFact: async (input) => {
      const saved = await updateMemoryFactAction(input);

      if (saved) {
        trackFactChange({ change: "updated", factId: input.factId, memory });
      }

      return saved;
    },
  };

  return <MemoryScreen actions={actions} memory={memory} />;
}
