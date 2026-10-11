"use client";

import { type PlanChangePreview } from "@zoonk/core/plans/preview-contract";
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
import { safeAsync } from "@zoonk/utils/error";
import { LayersIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useState } from "react";
import { useBasesEffectLines } from "./plan-bases-effect";
import { type BaseChoice, BaseGroup } from "./plan-bases-group";
import { PlanChangeApplied } from "./plan-change-applied";
import { type PlanChangeOutcome, usePlanScreen } from "./plan-context";
import { PlanFailedMessage } from "./plan-failed-message";
import { useAdviceText, useKnownText, usePrerequisitesDescription } from "./use-bases-texts";
import { usePlanChange } from "./use-plan-change";

type Choices = ReadonlyMap<string, BaseChoice>;

/** A pause after the last tap before the effect of the choices is planned. */
const PREVIEW_DELAY_MS = 300;

function toChoices(items: readonly PlanBaseView[]): Map<string, BaseChoice> {
  return new Map(items.map((item) => [item.skillId, item.choice]));
}

function followsRecommendation(bases: PlanBasesView, choices: Choices): boolean {
  return bases.items.every((item) => choices.get(item.skillId) === bases.recommended);
}

/** A preview read for the choices `key` stands for; null when it couldn't be read. */
type PreviewRead = { key: string; value: PlanChangePreview | null };

/**
 * What the choices would do, planned as saving them would, before the learner saves: the lessons
 * and topics that come in or leave, when the lessons end, and what the time then covers. Read
 * again a moment after each tap.
 */
function usePreview(changed: { choice: BaseChoice; skillId: string }[]) {
  const { actions } = usePlanScreen();
  const [preview, setPreview] = useState<PreviewRead | null>(null);

  // The key stands for the choices: a new array with the same choices plans nothing new.
  const key = JSON.stringify(changed);

  const load = useEffectEvent(() =>
    safeAsync(() => actions.preview([{ choices: changed, kind: "setBaseChoices" }])),
  );

  useEffect(() => {
    if (key === "[]") {
      return;
    }

    let current = true;

    const timer = setTimeout(async () => {
      const { data } = await load();

      if (current) {
        setPreview({ key, value: data ?? null });
      }
    }, PREVIEW_DELAY_MS);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [key]);

  if (changed.length === 0) {
    return { loading: false, preview: null };
  }

  return preview?.key === key
    ? { loading: false, preview: preview.value }
    : { loading: true, preview: null };
}

/** Under the choices: what they'd do, then Save. */
function BasesFooter({
  changed,
  failed,
  isPending,
  onSave,
}: {
  changed: { choice: BaseChoice; skillId: string }[];
  failed: boolean;
  isPending: boolean;
  onSave: () => void;
}) {
  const t = useExtracted();
  const effectLines = useBasesEffectLines();
  const { loading, preview } = usePreview(changed);
  const lines = preview?.ready ? effectLines({ ...preview, ready: true }) : [];

  return (
    <div className="flex flex-col gap-3 border-t px-6 pt-4 pb-6">
      {changed.length > 0 && (
        <div
          aria-busy={loading}
          aria-live="polite"
          className="text-muted-foreground flex flex-col gap-1 text-sm text-pretty aria-busy:opacity-60"
        >
          {loading && <p>{t("Checking what changes…")}</p>}
          {!loading && lines.length === 0 && <p>{t("Your plan stays as it is.")}</p>}
          {!loading && lines.map((line) => <p key={line}>{line}</p>)}
        </div>
      )}

      <Button disabled={isPending || changed.length === 0} focusableWhenDisabled onClick={onSave}>
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
  const t = useExtracted();
  const adviceText = useAdviceText();
  const knownText = useKnownText();
  const { change, failed, isPending } = usePlanChange();
  const [draft, setDraft] = useState<Choices>(() => toChoices(bases.items));
  const [outcome, setOutcome] = useState<PlanChangeOutcome | null>(null);

  if (outcome?.status === "applied" && outcome.change) {
    return <PlanChangeApplied change={outcome.change} icon={LayersIcon} onDone={onDone} />;
  }

  const changed = bases.items.flatMap((item) => {
    const choice = draft.get(item.skillId) ?? item.choice;
    return choice === item.choice ? [] : [{ choice, skillId: item.skillId }];
  });

  const areas = Map.groupBy(bases.items, (item) => item.area);

  const save = () =>
    change([{ choices: changed, kind: "setBaseChoices" }], (saved) => {
      if (saved?.status === "applied" && !saved.change) {
        onDone();
        return;
      }

      setOutcome(saved);
    });

  const choose = (skillIds: string[], choice: BaseChoice) =>
    setDraft(new Map([...draft, ...skillIds.map((skillId) => [skillId, choice] as const)]));

  const recommend = () =>
    setDraft(new Map(bases.items.map((item) => [item.skillId, bases.recommended])));

  return (
    <>
      <DrawerContent className="flex flex-col gap-5 pt-2">
        <div className="bg-muted/60 flex flex-col items-start gap-2 rounded-2xl p-4 text-sm">
          <p className="text-pretty">{adviceText(bases)}</p>
          {!followsRecommendation(bases, draft) && (
            <Button onClick={recommend} size="sm" variant="secondary">
              {t("Use the recommendation")}
            </Button>
          )}
        </div>

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
        onSave={() => void save()}
      />
    </>
  );
}

/**
 * The prerequisites' sheet: the skills the goal's topics or final work build on, worth less to it
 * than what builds on them, each to learn first, study for its essentials or skip, with the time
 * each takes, what the app recommends, and what the choices do before they're saved. Each opening
 * starts from the plan's own choices.
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
