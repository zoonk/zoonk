"use client";

import { Button } from "@zoonk/ui/components/button";
import { Checkbox } from "@zoonk/ui/components/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon, CrosshairIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { createContext, use, useId, useState } from "react";
import { DrawerCloseButton } from "../_components/details-drawer";
import { KindDot } from "../_components/kind-tile";
import { ChangeSaveError } from "../_components/save-error";
import { LearnLink } from "../learn-link";
import { CHOICE_CARD_PICKED_CLASS } from "../onboarding/choice-styles";
import { PlanBases } from "./plan-bases";
import { PlanChangeApplied } from "./plan-change-applied";
import { type PlanChangeOutcome, usePlanScreen } from "./plan-context";
import { usePlanChange } from "./use-plan-change";

const AREA_ROW_CLASS = cn(
  "border-border bg-card flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors motion-reduce:transition-none",
  "hover:bg-muted/60 has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px] has-data-disabled:pointer-events-none",
  CHOICE_CARD_PICKED_CLASS,
);

type PlanArea = ReturnType<typeof usePlanScreen>["plan"]["areas"][number];

/**
 * The subjects to choose from: the plan's areas still in it, each with the areas that are part of
 * it (the foreign language an ENEM candidate takes, inside the languages area), which go with it.
 */
function listFocusChoices(areas: readonly PlanArea[]): (PlanArea & { parts: string[] })[] {
  const kept = areas.filter((area) => !area.skipped);

  return kept
    .filter((area) => !area.partOf)
    .map((area) => ({
      ...area,
      parts: kept.filter((part) => part.partOf === area.name).map((part) => part.name),
    }));
}

/**
 * Whether the learner can choose where to focus: their time doesn't cover everything in depth and
 * the plan has more than one subject to choose from.
 */
export function useCanChooseFocus(): boolean {
  const { plan } = usePlanScreen();
  const areas = listFocusChoices(plan.areas);
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
      className="ring-input hover:bg-muted/70 focus-visible:ring-ring/50 rounded-option flex min-h-14 items-center gap-3 px-3.5 py-2.5 ring-1 transition-colors outline-none ring-inset focus-visible:ring-[3px]"
      href={href}
    >
      <KindDot kind="challenge" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{t("Take a short test")}</span>
        <span className="text-muted-foreground text-xs">{t("Your answers choose for you")}</span>
      </span>
      <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
    </LearnLink>
  );
}

/**
 * A subject to pick, with what's part of it (the language the learner takes, inside ENEM's
 * languages area), and the part of it in focus when the learner named one ("Only Biology and
 * Chemistry"): choosing subjects again keeps it. It stays as picked while the picks save.
 */
function AreaChoice({
  checked,
  disabled,
  name,
  onCheckedChange,
  part,
  parts,
}: {
  checked: boolean;
  disabled: boolean;
  name: string;
  onCheckedChange: (checked: boolean) => void;
  part: string | null;
  parts: readonly string[];
}) {
  const t = useExtracted();
  const format = useFormatter();

  return (
    <label className={AREA_ROW_CLASS}>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base font-medium">{name}</span>
        {parts.length > 0 && (
          <span className="text-muted-foreground text-sm">
            {t("Includes {parts}", { parts: format.list(parts, { type: "conjunction" }) })}
          </span>
        )}
        {part && checked && (
          <span className="text-muted-foreground text-sm">{t("Only {part}", { part })}</span>
        )}
      </span>
      <Checkbox
        checked={checked}
        className="size-5"
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </label>
  );
}

/**
 * The plan's subjects to pick from, the ones in focus checked, with the action under the list that
 * scrolls: what the learner picks gets its depth first, and every other topic stays in the plan.
 * Saving goes through the plan's own change, which plans again and can take seconds: the action
 * says it's saving meanwhile, then the sheet says what it did, or that nothing changed and why.
 */
function FocusChoices({ onSaved }: { onSaved: () => void }) {
  const t = useExtracted();
  const formId = useId();
  const format = useFormatter();
  const { focusTestHref, plan } = usePlanScreen();
  const { change, failed, isPending } = usePlanChange();
  const areas = listFocusChoices(plan.areas);
  const current = areas.filter((area) => area.focused).map((area) => area.name);
  const [chosen, setChosen] = useState<string[]>(current);
  const [outcome, setOutcome] = useState<PlanChangeOutcome | null>(null);

  const save = () =>
    change([{ areas: chosen, kind: "focusAreas" }], (saved) => {
      // A plan not built yet keeps the focus for when it is: there's no change to show.
      if (saved?.status === "applied" && !saved.change) {
        onSaved();
        return;
      }

      setOutcome(saved);
    });

  if (outcome?.status === "applied" && outcome.change) {
    return <PlanChangeApplied change={outcome.change} icon={CrosshairIcon} onDone={onSaved} />;
  }

  const unchanged = outcome?.status === "unchanged" ? outcome.reason : null;
  const names = format.list(chosen, { type: "conjunction" });

  return (
    <>
      <DrawerContent className="flex flex-col gap-5 pt-2">
        {unchanged && (
          <p className="bg-muted/60 rounded-xl p-4 text-sm text-pretty" role="status">
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
                disabled={isPending}
                key={area.name}
                name={area.name}
                onCheckedChange={(checked) => {
                  setOutcome(null);

                  setChosen(
                    checked ? [...chosen, area.name] : chosen.filter((name) => name !== area.name),
                  );
                }}
                part={area.focusPart}
                parts={area.parts}
              />
            ))}
          </fieldset>
        </form>
        <PlanBases />
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
          {isPending ? t("Saving…") : t("Focus on these")}
        </Button>

        {failed && <ChangeSaveError />}
      </div>
    </>
  );
}

const ChooseFocusContext = createContext<(() => void) | null>(null);

/**
 * Holds the "Where to focus" sheet for a plan screen, so it stays on what the choice did (with
 * Undo) after what opened it leaves, as "Study everything" does (see `StudyEverythingHost`): the
 * notice or the editor's coverage once the plan reads differently, which closed a focus's card by
 * itself and lost its Undo. It opens on arrival when the host opened the plan to choose (the
 * buddy's offer, `openFocus`).
 */
export function ChooseFocusHost({ children }: { children: React.ReactNode }) {
  const t = useExtracted();
  const { openFocus = false } = usePlanScreen();
  // Until the learner opens or closes it, it's open when the host opened the plan to choose.
  const [opened, setOpened] = useState<boolean | null>(null);
  const open = opened ?? openFocus;

  return (
    <ChooseFocusContext value={() => setOpened(true)}>
      {children}

      <Drawer onOpenChange={setOpened} open={open}>
        <DrawerPopup>
          <DrawerHeader className="flex-row items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <DrawerTitle className="text-xl font-semibold">{t("Where to focus")}</DrawerTitle>
              <DrawerDescription>
                {t("The subjects you pick come first and get more depth.")}
              </DrawerDescription>
            </div>
            <DrawerCloseButton />
          </DrawerHeader>

          {open && <FocusChoices onSaved={() => setOpened(false)} />}
        </DrawerPopup>
      </Drawer>
    </ChooseFocusContext>
  );
}

/** Opens the screen's "Where to focus" sheet (see `ChooseFocusHost`). */
export function useChooseFocus(): () => void {
  const open = use(ChooseFocusContext);

  if (!open) {
    throw new Error("ChooseFocus must be used within ChooseFocusHost");
  }

  return open;
}

/**
 * "Choose where to focus", for a plan whose time doesn't cover everything in depth: it opens the
 * screen's sheet (see `ChooseFocusHost`) with the plan's subjects, so the learner says which ones
 * get the depth, and an exam's prerequisites, to say how to study each. Every topic stays in the
 * plan either way.
 */
export function ChooseFocus() {
  const t = useExtracted();
  const open = useChooseFocus();

  return (
    <Button className="self-start" onClick={open} size="sm" type="button" variant="outline">
      {t("Choose where to focus")}
    </Button>
  );
}
