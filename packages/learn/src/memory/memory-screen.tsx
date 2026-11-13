"use client";

import {
  type MemoryChange,
  type MemoryChangeReference,
  type MemoryExport,
  type MemoryFactView,
  type MemoryView,
} from "@zoonk/core/memory/contract";
import { Switch } from "@zoonk/ui/components/switch";
import { showErrorToast, showSuccessToast } from "@zoonk/ui/components/toast";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useId, useOptimistic } from "react";
import { DownloadRow } from "../_components/download-row";
import { LIST_GROUP_CLASS, ListGroup } from "../_components/list-group";
import {
  PageSection,
  PageSectionFooter,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { SettingRow } from "../_components/setting-rows";
import { useOptimisticSave } from "../_utils/use-optimistic-save";
import { MemoryFactRow } from "./memory-fact-row";
import { type MemoryCategory, MemoryCategoryName } from "./memory-labels";
import { type MemoryUndoOutcome, toMemoryChangeReferences } from "./memory-updated";

export type MemoryActions = {
  deleteFact: (factId: string) => Promise<MemoryChange | null>;
  exportMemory: () => Promise<MemoryExport | null>;
  setEnabled: (enabled: boolean) => Promise<boolean>;
  undo: (changes: MemoryChangeReference[]) => Promise<MemoryUndoOutcome>;
  updateFact: (input: { factId: string; statement: string }) => Promise<boolean>;
};

type FactEdit = { id: string; statement: string | null };

function applyFactEdit(facts: MemoryFactView[], edit: FactEdit): MemoryFactView[] {
  if (edit.statement === null) {
    return facts.filter((fact) => fact.id !== edit.id);
  }

  const { statement } = edit;
  return facts.map((fact) => (fact.id === edit.id ? { ...fact, statement } : fact));
}

const CATEGORY_ORDER: MemoryCategory[] = [
  "goals",
  "background",
  "routine",
  "preferences",
  "learning",
  "context",
];

function groupByCategory(facts: MemoryFactView[]) {
  return CATEGORY_ORDER.map((category) => ({
    category,
    facts: facts.filter((fact) => fact.category === category),
  })).filter((group) => group.facts.length > 0);
}

function MemorySwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const t = useExtracted();
  const labelId = useId();
  const descriptionId = useId();

  return (
    <ListGroup>
      <SettingRow
        // Always there, so the rows under the switch don't move when it flips.
        description={t("When off, nothing new is saved and these notes aren't used.")}
        descriptionId={descriptionId}
        label={<span id={labelId}>{t("Use memory")}</span>}
      >
        <Switch
          aria-describedby={descriptionId}
          aria-labelledby={labelId}
          checked={enabled}
          onCheckedChange={onChange}
        />
      </SettingRow>
    </ListGroup>
  );
}

/** A removed note is offered back in a toast, so the list only closes the row's gap. */
function useUndoToast(undo: MemoryActions["undo"]) {
  const t = useExtracted();
  const removed = t("Removed from memory");
  const undoLabel = t("Undo");
  const failed = t("Couldn't undo. Try again.");
  const changed = t("Couldn't undo. It changed since.");

  return (change: MemoryChange) =>
    showSuccessToast(removed, {
      label: undoLabel,
      onClick: async () => {
        const { data: outcome } = await safeAsync(() => undo(toMemoryChangeReferences([change])));

        if (outcome !== "undone") {
          showErrorToast(outcome === "conflict" ? changed : failed);
        }
      },
    });
}

function useMemoryScreen({ actions, memory }: { actions: MemoryActions; memory: MemoryView }) {
  const [facts, editFacts] = useOptimistic(memory.facts, applyFactEdit);
  const [enabled, setOptimisticEnabled] = useOptimistic(memory.enabled);
  const { run } = useOptimisticSave();
  const offerUndo = useUndoToast(actions.undo);

  return {
    enabled,
    facts,
    removeFact: (factId: string) =>
      run(
        () => editFacts({ id: factId, statement: null }),
        async () => {
          const change = await actions.deleteFact(factId);

          if (change) {
            offerUndo(change);
          }

          return change !== null;
        },
      ),
    setEnabled: (next: boolean) =>
      run(
        () => setOptimisticEnabled(next),
        () => actions.setEnabled(next),
      ),
    updateFact: (factId: string, statement: string) =>
      run(
        () => editFacts({ id: factId, statement }),
        () => actions.updateFact({ factId, statement }),
      ),
  };
}

export function MemoryScreen({ actions, memory }: { actions: MemoryActions; memory: MemoryView }) {
  const t = useExtracted();
  const screen = useMemoryScreen({ actions, memory });
  const groups = groupByCategory(screen.facts);

  return (
    <div className="flex flex-col gap-7" data-slot="memory-screen">
      <MemorySwitch enabled={screen.enabled} onChange={screen.setEnabled} />

      {groups.length === 0 && screen.enabled && (
        <p className="text-muted-foreground text-sm">
          {t("Nothing yet. Notes show up here as you study and chat.")}
        </p>
      )}

      {groups.map((group) => (
        <PageSection aria-labelledby={`memory-${group.category}`} key={group.category}>
          <PageSectionHeader>
            <PageSectionTitle id={`memory-${group.category}`}>
              <MemoryCategoryName category={group.category} />
            </PageSectionTitle>
          </PageSectionHeader>

          <ul className={LIST_GROUP_CLASS}>
            {group.facts.map((fact) => (
              <MemoryFactRow
                fact={fact}
                memoryEnabled={screen.enabled}
                key={fact.id}
                onDelete={() => screen.removeFact(fact.id)}
                onEdit={(statement) => screen.updateFact(fact.id, statement)}
              />
            ))}
          </ul>
        </PageSection>
      ))}

      <footer className="flex flex-col gap-4">
        {groups.length > 0 && (
          <ListGroup>
            <DownloadRow
              fileName="zoonk-memory.json"
              label={t("Download my memory")}
              load={actions.exportMemory}
            />
          </ListGroup>
        )}
        <PageSectionFooter>
          {t(
            "Zoonk doesn't keep health, religion or other sensitive details unless you ask it to.",
          )}
        </PageSectionFooter>
      </footer>
    </div>
  );
}
