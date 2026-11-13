"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { type PlanBaseView, type PlanBasesView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { Drawer, DrawerContent, DrawerPopup, DrawerTitle } from "@zoonk/ui/components/drawer";
import { LayersIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { QUIET_ACTION_CLASS } from "../_components/quiet-disclosure";
import { SheetHeader } from "../_components/sheet-header";
import { PlanEffectDiff, PlanEffectNote } from "../plan-diff/plan-effect-diff";
import { BasesAdvice, useBasesAdvice } from "./plan-bases-advice";
import {
  AllBasesChoice,
  type BaseChoice,
  BasesBySubject,
  chooseFor,
  getSharedChoice,
  listOpen,
} from "./plan-bases-choices";
import { PlanChangeApplied } from "./plan-change-applied";
import { type PlanChangeOutcome, usePlanScreen } from "./plan-context";
import { type PlanPreviewState, currentPlanPreview } from "./plan-preview-state";
import { usePlanDateKind } from "./use-change-sentence";
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
  isPending,
  onSave,
  onRetry,
  preview,
}: {
  changed: { choice: BaseChoice; skillId: string }[];
  isPending: boolean;
  onSave: () => void;
  onRetry: () => void;
  preview: PlanPreviewState;
}) {
  const t = useExtracted();
  const dateKind = usePlanDateKind();
  const saveButton = useRef<HTMLButtonElement>(null);

  // Try again gives way to the check: the keyboard waits on Save, which opens once it's done.
  const retry = () => {
    onRetry();
    saveButton.current?.focus();
  };

  const changes = preview.status === "ready" && !preview.preview.unchanged ? preview.preview : null;

  // The note's room is there before a pick, so picking, checking and the answer move nothing.
  const note = () => {
    if (changed.length === 0 || (preview.status === "ready" && preview.preview.unchanged)) {
      return <PlanEffectNote>{t("Your plan stays as it is.")}</PlanEffectNote>;
    }

    if (preview.status === "failed") {
      return (
        <PlanEffectNote
          action={
            <button className={QUIET_ACTION_CLASS} onClick={retry} type="button">
              {t("Try again")}
            </button>
          }
        >
          {t("We couldn't check what changes.")}
        </PlanEffectNote>
      );
    }

    return changes ? (
      <PlanEffectDiff dateKind={dateKind} effect={changes.effect} />
    ) : (
      <PlanEffectNote busy>{t("Checking what changes…")}</PlanEffectNote>
    );
  };

  return (
    <div className="flex flex-col gap-3 border-t px-6 pt-4 pb-6">
      <div aria-live="polite">{note()}</div>

      <Button
        disabled={isPending || changed.length === 0 || preview.status !== "ready"}
        focusableWhenDisabled
        onClick={onSave}
        ref={saveButton}
      >
        {t("Save")}
      </Button>
    </div>
  );
}

function BasesChoices({ bases, onDone }: { bases: PlanBasesView; onDone: () => void }) {
  const advice = useBasesAdvice();
  const { change, isPending } = usePlanChange();
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
      </DrawerContent>

      <BasesFooter
        changed={changed}
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

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup>
        <SheetHeader>
          <DrawerTitle>{t("Prerequisites")}</DrawerTitle>
        </SheetHeader>

        {open && <BasesChoices bases={bases} onDone={() => onOpenChange(false)} />}
      </DrawerPopup>
    </Drawer>
  );
}
