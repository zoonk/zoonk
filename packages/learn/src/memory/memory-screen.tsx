"use client";

import {
  type MemoryChange,
  type MemoryChangeReference,
  type MemoryExport,
  type MemoryFactView,
  type MemoryView,
} from "@zoonk/core/memory/contract";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { downloadFile } from "@zoonk/utils/download";
import { safeAsync } from "@zoonk/utils/error";
import { DownloadIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { LIST_GROUP_CLASS, ListGroup } from "../_components/list-group";
import {
  PageSection,
  PageSectionFooter,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { ChangeSaveError } from "../_components/save-error";
import { SettingRow, SwitchSettingRow } from "../_components/setting-rows";
import { useOptimisticSave } from "../_utils/use-optimistic-save";
import { MemoryFactRow } from "./memory-fact-row";
import { type MemoryCategory, MemoryCategoryName } from "./memory-labels";
import { MemoryUpdated } from "./memory-updated";

export type MemoryActions = {
  deleteFact: (factId: string) => Promise<MemoryChange | null>;
  exportMemory: () => Promise<MemoryExport | null>;
  setEnabled: (enabled: boolean) => Promise<boolean>;
  undo: (changes: MemoryChangeReference[]) => Promise<boolean>;
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

function MemorySwitchDescription({ enabled }: { enabled: boolean }) {
  const t = useExtracted();

  return enabled
    ? t("Personal examples and plans that fit your week")
    : t("Memory is off. Nothing new is learned, and these facts aren't used.");
}

function MemorySwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const t = useExtracted();

  return (
    <ListGroup>
      <SwitchSettingRow
        checked={enabled}
        description={<MemorySwitchDescription enabled={enabled} />}
        label={t("Use memory")}
        onCheckedChange={onChange}
      />
    </ListGroup>
  );
}

function MemoryExportRow({ exportMemory }: Pick<MemoryActions, "exportMemory">) {
  const t = useExtracted();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const download = () => {
    startTransition(async () => {
      const { data } = await safeAsync(exportMemory);
      setFailed(!data);

      if (data) {
        downloadFile(JSON.stringify(data, null, 2), "zoonk-memory.json", "application/json");
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <ListGroup>
        <SettingRow
          description={t("Everything in your memory, as one file")}
          label={t("Download my memory")}
        >
          <Button
            aria-label={isPending ? t("Preparing your memory…") : t("Download my memory")}
            disabled={isPending}
            onClick={download}
            size="sm"
            variant="outline"
          >
            {isPending ? <Spinner aria-hidden="true" /> : <DownloadIcon aria-hidden="true" />}
            {isPending ? t("Preparing…") : t("Download")}
          </Button>
        </SettingRow>
      </ListGroup>
      {failed && (
        <p className="text-destructive-text text-sm" role="alert">
          {t("We couldn't prepare the download. Try again.")}
        </p>
      )}
    </div>
  );
}

function useMemoryScreen({ actions, memory }: { actions: MemoryActions; memory: MemoryView }) {
  const [facts, editFacts] = useOptimistic(memory.facts, applyFactEdit);
  const [enabled, setOptimisticEnabled] = useOptimistic(memory.enabled);
  const [lastChange, setLastChange] = useState<MemoryChange | null>(null);
  const { failed, run } = useOptimisticSave();

  return {
    enabled,
    facts,
    failed,
    lastChange,
    removeFact: (factId: string) =>
      run(
        () => editFacts({ id: factId, statement: null }),
        async () => {
          const change = await actions.deleteFact(factId);
          setLastChange(change);
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

      {screen.lastChange && (
        <MemoryUpdated
          changes={[screen.lastChange]}
          key={screen.lastChange.previous?.id}
          onUndo={actions.undo}
        />
      )}

      {screen.failed && <ChangeSaveError />}

      {groups.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {screen.enabled
            ? t(
                "Nothing yet. As you study and chat, short notes that help Zoonk teach you show up here.",
              )
            : t("Nothing here. Zoonk keeps no notes about you while memory is off.")}
        </p>
      ) : (
        groups.map((group) => (
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
                  key={fact.id}
                  onDelete={() => screen.removeFact(fact.id)}
                  onEdit={(statement) => screen.updateFact(fact.id, statement)}
                />
              ))}
            </ul>
          </PageSection>
        ))
      )}

      <footer className="flex flex-col gap-4">
        <MemoryExportRow exportMemory={actions.exportMemory} />
        <PageSectionFooter>
          {t(
            "Zoonk doesn't keep health, religion or other sensitive details unless you ask it to.",
          )}
        </PageSectionFooter>
      </footer>
    </div>
  );
}
