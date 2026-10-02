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
import { SectionLabel } from "../_components/section-label";
import {
  SettingCard,
  SettingCardControl,
  SettingCardDescription,
  SettingCardLabel,
  SettingCardText,
} from "../_components/setting-card";
import { useOptimisticSave } from "../_utils/use-optimistic-save";
import { MemoryFactRow } from "./memory-fact-row";
import { type MemoryCategory, MemoryCategoryName } from "./memory-labels";
import { MemoryUpdated } from "./memory-updated";

/** How the Memory screen reaches the server. Each resolves to whether it worked. */
export type MemoryActions = {
  deleteFact: (factId: string) => Promise<MemoryChange | null>;
  exportMemory: () => Promise<MemoryExport | null>;
  setEnabled: (enabled: boolean) => Promise<boolean>;
  undo: (changes: MemoryChangeReference[]) => Promise<boolean>;
  updateFact: (input: { factId: string; statement: string }) => Promise<boolean>;
};

type FactEdit = { id: string; statement: string | null };

/** A null statement removes the fact; anything else rewrites it. */
function applyFactEdit(facts: MemoryFactView[], edit: FactEdit): MemoryFactView[] {
  if (edit.statement === null) {
    return facts.filter((fact) => fact.id !== edit.id);
  }

  const { statement } = edit;
  return facts.map((fact) => (fact.id === edit.id ? { ...fact, statement } : fact));
}

function groupByCategory({
  categories,
  facts,
}: {
  categories: MemoryCategory[];
  facts: MemoryFactView[];
}) {
  return categories
    .map((category) => ({ category, facts: facts.filter((fact) => fact.category === category) }))
    .filter((group) => group.facts.length > 0);
}

const SECTION_CLASS =
  "border-border bg-background in-data-[mode=fun]:fun-glass overflow-hidden rounded-2xl border";

function MemorySwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const t = useExtracted();
  const descriptionId = useId();
  const labelId = useId();

  return (
    <SettingCard className="bg-background gap-4">
      <SettingCardText>
        <SettingCardLabel id={labelId}>{t("Use memory")}</SettingCardLabel>
        <SettingCardDescription id={descriptionId}>
          {enabled
            ? t("Personal examples and plans that fit your week")
            : t("Memory is off. Nothing new is learned, and these facts aren't used.")}
        </SettingCardDescription>
      </SettingCardText>

      <SettingCardControl>
        <Switch
          aria-describedby={descriptionId}
          aria-labelledby={labelId}
          checked={enabled}
          onCheckedChange={onChange}
        />
      </SettingCardControl>
    </SettingCard>
  );
}

function MemoryExportButton({ exportMemory }: Pick<MemoryActions, "exportMemory">) {
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
    <div className="flex flex-col items-start gap-1">
      <Button disabled={isPending} onClick={download} size="sm" variant="outline">
        <DownloadIcon aria-hidden="true" />
        {t("Download my memory")}
      </Button>
      {failed && (
        <p className="text-destructive text-sm" role="alert">
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

/**
 * Everything Zoonk remembers, grouped by category, with where each fact came from. The learner can
 * correct or delete any fact (with undo), turn memory off and download it. Minors only see the
 * categories their memory may hold.
 */
export function MemoryScreen({ actions, memory }: { actions: MemoryActions; memory: MemoryView }) {
  const t = useExtracted();
  const screen = useMemoryScreen({ actions, memory });
  const groups = groupByCategory({ categories: memory.categories, facts: screen.facts });

  return (
    <div className="flex flex-col gap-6" data-slot="memory-screen">
      <MemorySwitch enabled={screen.enabled} onChange={screen.setEnabled} />

      {screen.lastChange && (
        <MemoryUpdated
          changes={[screen.lastChange]}
          key={screen.lastChange.previous?.id}
          onUndo={actions.undo}
        />
      )}

      {screen.failed && (
        <p className="text-destructive text-sm" role="alert">
          {t("That didn't save. Try again.")}
        </p>
      )}

      {groups.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          {t(
            "Nothing yet. As you study and chat, short notes that help Zoonk teach you show up here.",
          )}
        </p>
      ) : (
        groups.map((group) => (
          <section
            aria-labelledby={`memory-${group.category}`}
            className="flex flex-col gap-2"
            key={group.category}
          >
            <SectionLabel className="px-1" id={`memory-${group.category}`}>
              <MemoryCategoryName category={group.category} />
            </SectionLabel>

            <ul className={`${SECTION_CLASS} divide-border divide-y`}>
              {group.facts.map((fact) => (
                <MemoryFactRow
                  fact={fact}
                  key={fact.id}
                  onDelete={() => screen.removeFact(fact.id)}
                  onEdit={(statement) => screen.updateFact(fact.id, statement)}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      <footer className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          {t(
            "Zoonk doesn't keep health, religion or other sensitive details unless you ask it to.",
          )}
        </p>
        <MemoryExportButton exportMemory={actions.exportMemory} />
      </footer>
    </div>
  );
}
