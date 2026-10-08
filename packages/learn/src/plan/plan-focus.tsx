"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { Checkbox } from "@zoonk/ui/components/checkbox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import { safeAsync } from "@zoonk/utils/error";
import { ChevronRightIcon, CrosshairIcon, XIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useId, useState, useTransition } from "react";
import { KindTile } from "../_components/kind-tile";
import { LearnLink } from "../learn-link";
import { type PlanChangeOutcome, usePlanScreen } from "./plan-context";
import { PlanFailedMessage } from "./plan-failed-message";
import { useChangeSentence, useProposalEffectText } from "./use-change-sentence";
import { usePlanChange } from "./use-plan-change";

const AREA_ROW_CLASS = cn(
  "border-border bg-card flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors motion-reduce:transition-none",
  "hover:bg-muted/60 has-data-checked:border-foreground has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px]",
);

/**
 * Whether the learner can choose where to focus: their time doesn't cover everything in depth and
 * the plan has more than one subject to choose from.
 */
export function useCanChooseFocus(): boolean {
  const { plan } = usePlanScreen();
  const areas = plan.areas.filter((area) => !area.skipped);
  return Boolean(plan.feasibility?.deadline && !plan.feasibility.fits && areas.length > 1);
}

function sameAreas(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((area) => b.includes(area));
}

/** The focus test, offered first: a few questions, and the answers choose where the depth goes. */
function FocusTestLink({ href }: { href: string }) {
  const t = useExtracted();

  return (
    <LearnLink
      className="bg-muted/60 hover:bg-muted focus-visible:ring-ring/50 flex min-h-16 items-center gap-3 rounded-2xl p-3 transition-colors outline-none focus-visible:ring-[3px]"
      href={href}
    >
      <KindTile icon={CrosshairIcon} kind="challenge" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{t("Take a short test")}</span>
        <span className="text-muted-foreground text-sm">{t("Your answers choose for you")}</span>
      </span>
      <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
    </LearnLink>
  );
}

/**
 * What a focus did, in the sheet that set it: what changes (when the subjects start, the lessons
 * they gain) with Done, and Undo while it's the plan's latest change.
 */
function FocusApplied({ change, onDone }: { change: PlanChangeView; onDone: () => void }) {
  const t = useExtracted();
  const sentence = useChangeSentence();
  const effectText = useProposalEffectText();
  const { actions } = usePlanScreen();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const effect = effectText(change);

  const undo = () => {
    setFailed(false);

    startTransition(async () => {
      const { data: undone } = await safeAsync(() =>
        actions.decide({ changeId: change.id, status: "undone" }),
      );

      if (undone) {
        onDone();
      } else {
        setFailed(true);
      }
    });
  };

  return (
    <>
      <DrawerContent className="flex flex-col gap-3 pt-2">
        <div className="flex items-start gap-3" role="status">
          <KindTile icon={CrosshairIcon} kind="challenge" size="sm" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="font-medium text-balance">{sentence(change)}</p>
            {effect && <p className="text-muted-foreground text-sm">{effect}</p>}
          </div>
        </div>
      </DrawerContent>

      <div className="flex flex-col gap-2 border-t px-6 pt-4 pb-6">
        <Button onClick={onDone}>{t("Done")}</Button>
        {change.canUndo && (
          <Button disabled={isPending} focusableWhenDisabled onClick={undo} variant="outline">
            {t("Undo")}
          </Button>
        )}
        {failed && <PlanFailedMessage />}
      </div>
    </>
  );
}

/**
 * A subject to pick, with the part of it in focus when the learner named one ("Only Biology and
 * Chemistry"): choosing subjects again keeps it.
 */
function AreaChoice({
  checked,
  name,
  onCheckedChange,
  part,
}: {
  checked: boolean;
  name: string;
  onCheckedChange: (checked: boolean) => void;
  part: string | null;
}) {
  const t = useExtracted();

  return (
    <label className={AREA_ROW_CLASS}>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base font-medium">{name}</span>
        {part && checked && (
          <span className="text-muted-foreground text-sm">{t("Only {part}", { part })}</span>
        )}
      </span>
      <Checkbox
        aria-label={name}
        checked={checked}
        className="size-5"
        onCheckedChange={onCheckedChange}
      />
    </label>
  );
}

/**
 * The plan's subjects to pick from, the ones in focus checked, with the action under the list that
 * scrolls: what the learner picks gets its depth first, and every other topic stays in the plan.
 * Saving goes through the plan's own change, and the sheet says what it did, or that nothing
 * changed and why.
 */
function FocusChoices({ onSaved }: { onSaved: () => void }) {
  const t = useExtracted();
  const formId = useId();
  const format = useFormatter();
  const { focusTestHref, plan } = usePlanScreen();
  const { change, failed, isPending } = usePlanChange();
  const areas = plan.areas.filter((area) => !area.skipped);
  const current = areas.filter((area) => area.focused).map((area) => area.name);
  const [chosen, setChosen] = useState<string[]>(current);
  const [outcome, setOutcome] = useState<PlanChangeOutcome | null>(null);

  const save = async () => {
    const saved = await change([{ areas: chosen, kind: "focusAreas" }]);

    // A plan not built yet keeps the focus for when it is: there's no change to show.
    if (saved?.status === "applied" && !saved.change) {
      onSaved();
      return;
    }

    setOutcome(saved);
  };

  if (outcome?.status === "applied" && outcome.change) {
    return <FocusApplied change={outcome.change} onDone={onSaved} />;
  }

  const unchanged = outcome?.status === "unchanged" ? outcome.reason : null;
  const names = format.list(chosen, { type: "conjunction" });

  return (
    <>
      <DrawerContent className="flex flex-col gap-5 pt-2">
        {unchanged && (
          <p className="bg-muted/60 rounded-2xl p-4 text-sm text-pretty" role="status">
            {unchanged === "alreadyIn"
              ? t("Nothing changed: {areas} already have every lesson in your plan.", {
                  areas: names,
                })
              : t(
                  "Nothing changed: {areas} already start as early as what they build on allows, and your time has no room for more of them. More time a day brings more in.",
                  { areas: names },
                )}
          </p>
        )}
        {focusTestHref && <FocusTestLink href={focusTestHref} />}
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <fieldset className="flex flex-col gap-2">
            <legend
              className={
                focusTestHref ? "text-muted-foreground pb-1 text-sm font-medium" : "sr-only"
              }
            >
              {focusTestHref ? t("Or choose them yourself") : t("Subjects to focus on")}
            </legend>
            {areas.map((area) => (
              <AreaChoice
                checked={chosen.includes(area.name)}
                key={area.name}
                name={area.name}
                onCheckedChange={(checked) => {
                  setOutcome(null);

                  setChosen(
                    checked ? [...chosen, area.name] : chosen.filter((name) => name !== area.name),
                  );
                }}
                part={area.focusPart}
              />
            ))}
          </fieldset>
        </form>
      </DrawerContent>

      <div className="flex flex-col gap-2 border-t px-6 pt-4 pb-6">
        <Button
          disabled={
            isPending || chosen.length === 0 || sameAreas(chosen, current) || unchanged !== null
          }
          focusableWhenDisabled
          form={formId}
          type="submit"
        >
          {t("Focus on these")}
        </Button>

        {failed && <PlanFailedMessage />}
      </div>
    </>
  );
}

/**
 * "Choose where to focus", for a plan whose time doesn't cover everything in depth: a sheet with
 * the plan's subjects, so the learner says which ones get the depth. Every topic stays in the
 * plan either way. `openOnArrival` opens it when the plan was opened to choose (the buddy's offer).
 */
export function ChooseFocus({
  openOnArrival = false,
  variant = "outline",
}: {
  openOnArrival?: boolean;
  variant?: "ghost" | "outline";
}) {
  const t = useExtracted();
  // Until the learner opens or closes it, it's open when the host opened the plan to choose.
  const [opened, setOpened] = useState<boolean | null>(null);
  const open = opened ?? openOnArrival;

  return (
    <>
      <Button
        className="self-start"
        onClick={() => setOpened(true)}
        size="sm"
        type="button"
        variant={variant}
      >
        {t("Choose where to focus")}
      </Button>

      <Drawer onOpenChange={setOpened} open={open}>
        <DrawerPopup>
          <DrawerHeader className="flex-row items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <DrawerTitle className="text-xl font-semibold">{t("Where to focus")}</DrawerTitle>
              <DrawerDescription>
                {t("The subjects you pick come first and get more depth.")}
              </DrawerDescription>
            </div>
            <DrawerClose render={<Button className="-mr-2" size="icon" variant="ghost" />}>
              <XIcon aria-hidden="true" />
              <span className="sr-only">{t("Close")}</span>
            </DrawerClose>
          </DrawerHeader>

          <FocusChoices onSaved={() => setOpened(false)} />
        </DrawerPopup>
      </Drawer>
    </>
  );
}
