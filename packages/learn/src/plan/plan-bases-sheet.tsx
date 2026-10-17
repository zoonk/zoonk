"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { type PlanBaseView, type PlanBasesView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { LayersIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { BasesAdvice } from "./plan-bases-advice";
import { useBasesEffectLines } from "./plan-bases-effect";
import { type BaseChoice, BaseGroup } from "./plan-bases-group";
import { PlanChangeApplied } from "./plan-change-applied";
import { type PlanChangeOutcome, usePlanScreen } from "./plan-context";
import { PlanFailedMessage } from "./plan-failed-message";
import { type PlanPreviewState, currentPlanPreview } from "./plan-preview-state";
import { useKnownText, usePrerequisitesDescription } from "./use-bases-texts";
import { usePlanChange } from "./use-plan-change";
import { usePlanPreview, usePreviewBase } from "./use-plan-preview";

type Choices = ReadonlyMap<string, BaseChoice>;

/** A pause after the last tap before the effect of the choices is planned. */
const PREVIEW_DELAY_MS = 300;

function toChoices(items: readonly PlanBaseView[]): Map<string, BaseChoice> {
  return new Map(items.map((item) => [item.skillId, item.choice]));
}

/**
 * The current choices' computed effect; older reads leave Save disabled. The wait and the request
 * follow the choices and the plan's content (`usePreviewBase`): a refresh that delivers the same
 * plan again neither cancels them nor starts them over.
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

/** Under the choices: what they'd do, then Save. */
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
  const effectLines = useBasesEffectLines();
  const saveButton = useRef<HTMLButtonElement>(null);
  const loading = preview.status === "idle" || preview.status === "loading";

  // Try again gives way to the check: the keyboard waits on Save, which opens once it's done.
  const retry = () => {
    onRetry();
    saveButton.current?.focus();
  };

  const lines =
    preview.status === "ready" && !preview.preview.unchanged
      ? effectLines({ ...preview.preview, ready: true })
      : [];

  return (
    <div className="flex flex-col gap-3 border-t px-6 pt-4 pb-6">
      {changed.length > 0 && (
        <div
          aria-busy={loading}
          aria-live="polite"
          className="text-muted-foreground flex flex-col gap-1 text-sm text-pretty aria-busy:opacity-60"
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
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
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

      {failed && <PlanFailedMessage />}
    </div>
  );
}

/**
 * The prerequisites' choices by subject, each subject one choice that opens to choose each
 * prerequisite, with what they'd do before saving them.
 */
function BasesChoices({ bases, onDone }: { bases: PlanBasesView; onDone: () => void }) {
  const knownText = useKnownText();
  const { change, failed, isPending } = usePlanChange();
  const [draft, setDraft] = useState<Choices>(() => toChoices(bases.items));
  const [outcome, setOutcome] = useState<PlanChangeOutcome | null>(null);

  const changed = bases.items.flatMap((item) => {
    const choice = draft.get(item.skillId) ?? item.choice;
    return choice === item.choice ? [] : [{ choice, skillId: item.skillId }];
  });

  const { preview, retry } = usePreview(changed);

  if (outcome?.status === "applied" && outcome.change) {
    return <PlanChangeApplied change={outcome.change} icon={LayersIcon} onDone={onDone} />;
  }

  const areas = Map.groupBy(bases.items, (item) => item.area);

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
    setDraft(new Map([...draft, ...skillIds.map((skillId) => [skillId, choice] as const)]));

  const recommend = (recommended: BaseChoice) =>
    setDraft(new Map(bases.items.map((item) => [item.skillId, recommended])));

  return (
    <>
      <DrawerContent className="flex flex-col gap-5 pt-2">
        <BasesAdvice bases={bases} choices={draft} onUse={recommend} />

        <p className="text-muted-foreground text-sm text-pretty">{knownText(bases)}</p>

        {[...areas].map(([area, items]) => (
          <BaseGroup
            area={area}
            choiceOf={(item) => draft.get(item.skillId) ?? item.choice}
            disabled={isPending}
            items={items}
            key={area}
            onChoose={choose}
          />
        ))}
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

/**
 * The prerequisites' sheet: the skills the goal's topics or final work build on, worth less to it
 * than what builds on them, each to learn first, study for its essentials or skip, with the time
 * each takes, what the app recommends when the learner asks, and what the choices do before
 * they're saved. Each opening starts from the plan's own choices.
 */
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
          <DrawerClose render={<Button className="-mr-2" size="icon" variant="ghost" />}>
            <XIcon aria-hidden="true" />
            <span className="sr-only">{t("Close")}</span>
          </DrawerClose>
        </DrawerHeader>

        {open && <BasesChoices bases={bases} onDone={() => onOpenChange(false)} />}
      </DrawerPopup>
    </Drawer>
  );
}
