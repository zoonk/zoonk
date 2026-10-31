"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { type PlanBaseView, type PlanBasesView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { LayersIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { DrawerCloseButton } from "../_components/details-drawer";
import { ChangeSaveError } from "../_components/save-error";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import { BasesAdvice, useBasesAdvice } from "./plan-bases-advice";
import {
  AllBasesChoice,
  type BaseChoice,
  BasesBySubject,
  chooseFor,
  getSharedChoice,
  listOpen,
} from "./plan-bases-choices";
import { useBasesFootnote } from "./plan-bases-effect";
import { PlanChangeApplied } from "./plan-change-applied";
import { type PlanChangeOutcome, usePlanScreen } from "./plan-context";
import { type PlanPreviewState, currentPlanPreview } from "./plan-preview-state";
import { useKnownText, usePrerequisitesDescription } from "./use-bases-texts";
import { usePlanChange } from "./use-plan-change";
import { usePlanPreview, usePreviewBase } from "./use-plan-preview";

type Choices = ReadonlyMap<string, BaseChoice>;

const PREVIEW_DELAY_MS = 300;

function toChoices(items: readonly PlanBaseView[]): Map<string, BaseChoice> {
  return new Map(items.map((item) => [item.skillId, item.choice]));
}

/**
 * Keyed by the choices and the plan's content, so a refresh with the same plan neither cancels the
 * preview nor starts it over.
 */
function usePreview(changed: { choice: BaseChoice; skillId: string }[]) {
  const { plan } = usePlanScreen();
  const base = usePreviewBase();
  const { preview, requestPreview, setPreview } = usePlanPreview();
  const operations: LearnerPlanOperation[] = [{ choices: changed, kind: "setBaseChoices" }];
  const key = JSON.stringify(changed);

  const load = useEffectEvent((revision: object) => {
    if (revision === base) {
      return requestPreview(operations);
    }
  });

  const cancel = useEffectEvent(setPreview);

  useEffect(() => {
    if (key === "[]") {
      return;
    }

    const timer = setTimeout(() => void load(base), PREVIEW_DELAY_MS);

    return () => {
      clearTimeout(timer);
      cancel();
    };
  }, [key, base]);

  return {
    preview: currentPlanPreview({ operations, plan, state: preview }),
    retry: () => void requestPreview(operations),
  };
}

function BasesFooter({
  changed,
  failed,
  isPending,
  onSave,
  onRetry,
  preview,
}: {
  changed: { choice: BaseChoice; skillId: string }[];
  failed: boolean;
  isPending: boolean;
  onSave: () => void;
  onRetry: () => void;
  preview: PlanPreviewState;
}) {
  const t = useExtracted();
  const footnote = useBasesFootnote();
  const saveButton = useRef<HTMLButtonElement>(null);
  const loading = preview.status === "idle" || preview.status === "loading";

  // Try again gives way to the check: the keyboard waits on Save, which opens once it's done.
  const retry = () => {
    onRetry();
    saveButton.current?.focus();
  };

  const changes = preview.status === "ready" && !preview.preview.unchanged ? preview.preview : null;

  const notes = changes ? footnote({ ...changes, ready: true }) : [];

  return (
    <div className="flex flex-col gap-3 border-t px-6 pt-4 pb-6">
      {changed.length > 0 && (
        <div
          aria-busy={loading}
          aria-live="polite"
          className="text-muted-foreground flex flex-col gap-2 text-sm text-pretty aria-busy:opacity-60"
        >
          {loading && <p>{t("Checking what changes…")}</p>}
          {preview.status === "failed" && (
            <>
              <p>{t("We couldn't check what changes.")}</p>
              <Button className="self-start" onClick={retry} size="sm" variant="outline">
                {t("Try again")}
              </Button>
            </>
          )}
          {preview.status === "ready" && preview.preview.unchanged && (
            <p>{t("Your plan stays as it is.")}</p>
          )}
          {changes && <PlanEffectDiff effect={changes.effect} />}
          {notes.length > 0 && <p className="text-xs leading-snug">{notes.join(" ")}</p>}
        </div>
      )}

      <Button
        disabled={isPending || changed.length === 0 || preview.status !== "ready"}
        focusableWhenDisabled
        onClick={onSave}
        ref={saveButton}
      >
        {t("Save choices")}
      </Button>

      {failed && <ChangeSaveError />}
    </div>
  );
}

function BasesChoices({ bases, onDone }: { bases: PlanBasesView; onDone: () => void }) {
  const t = useExtracted();
  const knownText = useKnownText();
  const advice = useBasesAdvice();
  const { change, failed, isPending } = usePlanChange();
  const [draft, setDraft] = useState<Choices>(() => toChoices(bases.items));
  const [outcome, setOutcome] = useState<PlanChangeOutcome | null>(null);
  const choiceOf = (item: PlanBaseView) => draft.get(item.skillId) ?? item.choice;

  const changed = bases.items.flatMap((item) => {
    const choice = choiceOf(item);
    return choice === item.choice ? [] : [{ choice, skillId: item.skillId }];
  });

  const { preview, retry } = usePreview(changed);

  if (outcome?.status === "applied" && outcome.change) {
    return <PlanChangeApplied change={outcome.change} icon={LayersIcon} onDone={onDone} />;
  }

  const areas = [...Map.groupBy(bases.items, (item) => item.area)];
  const shared = getSharedChoice(listOpen(bases.items), choiceOf);
  const someStudied = bases.items.some((item) => item.studied);

  const save = () => {
    if (isPending || preview.status !== "ready" || changed.length === 0) {
      return;
    }

    void change(preview.operations, (saved) => {
      if (saved?.status === "applied" && !saved.change) {
        onDone();
        return;
      }

      setOutcome(saved);
    });
  };

  const choose = (skillIds: string[], choice: BaseChoice) =>
    setDraft(
      new Map([
        ...draft,
        ...bases.items
          .filter((item) => skillIds.includes(item.skillId))
          .map((item) => [item.skillId, chooseFor(item, choice, choiceOf(item))] as const),
      ]),
    );

  return (
    <>
      <DrawerContent className="flex flex-col gap-5 pt-2">
        <div className="flex flex-col gap-3">
          <AllBasesChoice
            items={bases.items}
            onChoose={(choice) =>
              choose(
                bases.items.map((item) => item.skillId),
                choice,
              )
            }
            readOnly={isPending}
            recommended={advice.recommended}
            value={shared}
          />

          {shared === null && (
            <p className="text-muted-foreground text-sm text-pretty">
              {t("Your prerequisites have different choices. Picking one above applies it to all.")}
            </p>
          )}

          {someStudied && (
            <p className="text-muted-foreground text-sm text-pretty">
              {t("Prerequisites you've studied stay studied.")}
            </p>
          )}

          <BasesAdvice
            ask={() => void advice.ask()}
            followed={changed.length === 0 && shared !== null && shared === advice.recommended}
            state={advice.state}
          />
        </div>

        {areas.length > 1 && (
          <BasesBySubject
            areas={areas}
            choiceOf={choiceOf}
            defaultOpen={getSharedChoice(listOpen(bases.items), (item) => item.choice) === null}
            onChoose={choose}
            readOnly={isPending}
          />
        )}

        <p className="text-muted-foreground text-sm text-pretty">{knownText(bases)}</p>
      </DrawerContent>

      <BasesFooter
        changed={changed}
        failed={failed}
        isPending={isPending}
        onRetry={retry}
        onSave={save}
        preview={preview}
      />
    </>
  );
}

export function PlanBasesSheet({
  bases,
  onOpenChange,
  open,
}: {
  bases: PlanBasesView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useExtracted();
  const description = usePrerequisitesDescription();

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup>
        <DrawerHeader className="flex-row items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <DrawerTitle className="text-xl font-semibold">{t("Prerequisites")}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </div>
          <DrawerCloseButton />
        </DrawerHeader>

        {open && <BasesChoices bases={bases} onDone={() => onOpenChange(false)} />}
      </DrawerPopup>
    </Drawer>
  );
}
