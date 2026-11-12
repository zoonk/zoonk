"use client";

import {
  type MemoryChange,
  type MemoryChangeReference,
  type MemoryExport,
  type MemoryFactView,
  type MemoryView,
} from "@zoonk/core/memory/contract";
import { Button } from "@zoonk/ui/components/button";
import { Switch } from "@zoonk/ui/components/switch";
import { downloadFile } from "@zoonk/utils/download";
import { safeAsync } from "@zoonk/utils/error";
import { DownloadIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useOptimistic, useState, useTransition } from "react";
import { LIST_GROUP_CLASS, ListGroup } from "../_components/list-group";
import {
  PageSection,
  PageSectionFooter,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { ChangeSaveError } from "../_components/save-error";
import { SettingRow } from "../_components/setting-rows";
import { useOptimisticSave } from "../_utils/use-optimistic-save";
import { MemoryFactRow } from "./memory-fact-row";
import { type MemoryCategory, MemoryCategoryName } from "./memory-labels";
import { type MemoryUndoOutcome, MemoryUpdated } from "./memory-updated";

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
        description={!enabled && t("Nothing is remembered or used while this is off.")}
        descriptionId={descriptionId}
        label={<span id={labelId}>{t("Use memory")}</span>}
      >
        <Switch
          aria-describedby={enabled ? undefined : descriptionId}
          aria-labelledby={labelId}
          checked={enabled}
          onCheckedChange={onChange}
        />
      </SettingRow>
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
        <SettingRow label={t("Download my memory")}>
          <form action={() => download()} className="contents">
            <Button
              aria-label={t("Download my memory")}
              busy={isPending}
              icon={<DownloadIcon aria-hidden="true" />}
              size="sm"
              type="submit"
              variant="outline"
            >
              {t("Download")}
            </Button>
          </form>
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
