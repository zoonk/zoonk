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
import { LIST_GROUP_CLASS } from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
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

/** Minors' memory keeps only goals and learning, and starts off until they turn it on. */
function isLearningOnly(categories: MemoryCategory[]): boolean {
  return categories.every((category) => category === "goals" || category === "learning");
}

/**
 * What the switch does, said where it's turned on: a learner under 18 reads what memory would keep
 * and that they can ask an adult, before choosing.
 */
function MemorySwitchDescription({
  enabled,
  learningOnly,
  offByGuardian,
}: {
  enabled: boolean;
  learningOnly: boolean;
  offByGuardian: boolean;
}) {
  const t = useExtracted();

  if (offByGuardian) {
    return t("Your guardian turned memory off.");
  }

  if (learningOnly) {
    return enabled
      ? t("Examples and answers that fit your goals and how you learn")
      : t(
          "Off. Turn it on and Zoonk remembers your goals and how you learn, to fit examples to you. Not sure? Ask a parent or guardian.",
        );
  }

  return enabled
    ? t("Personal examples and plans that fit your week")
    : t("Memory is off. Nothing new is learned, and these facts aren't used.");
}

function MemorySwitch({
  enabled,
  learningOnly,
  offByGuardian,
  onChange,
}: {
  enabled: boolean;
  learningOnly: boolean;
  offByGuardian: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const t = useExtracted();
  const descriptionId = useId();
  const labelId = useId();

  return (
    <SettingCard className="gap-4">
      <SettingCardText>
        <SettingCardLabel id={labelId}>{t("Use memory")}</SettingCardLabel>
        <SettingCardDescription id={descriptionId}>
          <MemorySwitchDescription
            enabled={enabled}
            learningOnly={learningOnly}
            offByGuardian={offByGuardian}
          />
        </SettingCardDescription>
      </SettingCardText>

      <SettingCardControl>
        <Switch
          aria-describedby={descriptionId}
          aria-labelledby={labelId}
          checked={enabled}
          disabled={offByGuardian}
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
 * correct or delete any fact (with undo), turn memory on or off and download it. Minors only see the
 * categories their memory may hold, and their memory starts off; a guardian can keep it off.
 */
export function MemoryScreen({ actions, memory }: { actions: MemoryActions; memory: MemoryView }) {
  const t = useExtracted();
  const screen = useMemoryScreen({ actions, memory });
  const groups = groupByCategory({ categories: memory.categories, facts: screen.facts });
  const learningOnly = isLearningOnly(memory.categories);

  return (
    <div className="flex flex-col gap-8" data-slot="memory-screen">
      <MemorySwitch
        enabled={screen.enabled}
        learningOnly={learningOnly}
        offByGuardian={memory.offByGuardian}
        onChange={screen.setEnabled}
      />

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
        <p className="text-muted-foreground px-1 text-sm">
          {learningOnly
            ? t(
                "Zoonk only remembers your goals and how you learn, never health, religion or other sensitive details.",
              )
            : t(
                "Zoonk doesn't keep health, religion or other sensitive details unless you ask it to.",
              )}
        </p>
        <MemoryExportButton exportMemory={actions.exportMemory} />
      </footer>
    </div>
  );
}
