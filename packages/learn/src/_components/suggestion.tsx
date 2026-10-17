"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@zoonk/ui/components/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import { SparkleIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { createContext, use, useEffect, useRef, useState } from "react";
import { type LearnLinkComponentProps } from "../learn-context";
import { LearnLink } from "../learn-link";
import { SURFACE_CLASS } from "./surface";

/** Where the suggestion's parts are drawn: the line, the aside's panel or the sheet. */
type Presentation = "line" | "panel" | "sheet";

/** Whether the learner answered: `true`, or the answer's name. */
type Answered = boolean | string;

type SuggestionValue = {
  answered: boolean;
  /** The suggestion's accessible name, which also names its sheet. */
  label: string;
  /** Its leading mark: the amber sparkle, or the kind's icon (muted). */
  mark: React.ReactNode;
  section: React.RefObject<HTMLElement | null>;
};

const SuggestionContext = createContext<SuggestionValue | null>(null);
const PresentationContext = createContext<Presentation>("panel");

function useSuggestion(): SuggestionValue {
  const value = use(SuggestionContext);

  if (!value) {
    throw new Error("Suggestion parts must be used within Suggestion");
  }

  return value;
}

/** The suggestion's frame: a hairline, never the stronger line of a control. */
const FRAME_CLASS = cn(SURFACE_CLASS, "ring-inset");

/** Under 72rem the line shows; from 72rem, where the page has its aside, the panel does. */
const LINE_CLASS = "min-[72rem]:hidden";
const PANEL_CLASS = "hidden min-[72rem]:flex";

const MARK_SIZE: Readonly<Record<Presentation, string>> = {
  line: "[&>svg]:size-4",
  panel: "[&>svg]:size-3.5",
  sheet: "[&>svg]:size-5",
};

/**
 * Focuses the suggestion on each answer (and on mount when it replaced another in place): its
 * answers give way to what the answer did, so the keyboard keeps its place instead of falling back
 * to the page.
 */
function useFocusOnAnswer({
  answered,
  focusOnMount,
  section,
}: {
  answered: Answered;
  focusOnMount: boolean;
  section: React.RefObject<HTMLElement | null>;
}) {
  const previous = useRef(focusOnMount ? null : answered);

  useEffect(() => {
    if ((answered || focusOnMount) && answered !== previous.current) {
      section.current?.focus();
    }

    previous.current = answered;
  }, [answered, focusOnMount, section]);
}

/**
 * Keeps the keyboard in the suggestion when the control it was on gives way in place (Preview to
 * the check, Try again to the result, Not now back to the offer): focus moves to the suggestion
 * instead of falling to the page. In the sheet, the sheet takes it.
 */
function useFocusOnRemovedControl(section: React.RefObject<HTMLElement | null>) {
  const control = useRef<Element | null>(null);

  useEffect(() => {
    const element = section.current;

    const remember = (event: FocusEvent) => {
      control.current = event.target instanceof Element ? event.target : null;
    };

    element?.addEventListener("focusin", remember);
    return () => element?.removeEventListener("focusin", remember);
  }, [section]);

  useEffect(() => {
    const lost = document.activeElement === document.body;

    if (lost && control.current && !control.current.isConnected) {
      section.current?.focus();
    }
  });
}

/**
 * The one thing a page wants the learner to know or decide (a plan suggestion, a change already
 * made, falling behind, an exam's moment, a document to upload), drawn one way everywhere. Under
 * 72rem it's one line under the page's work (`SuggestionLine`): its mark, one sentence and "View",
 * which opens the whole suggestion in a sheet from the bottom. From 72rem, where the page has its
 * aside, it's a panel there with everything inline (`SuggestionContent`), answered in place.
 * `SuggestionContent` draws the same parts in the sheet and in the panel, so a suggestion is
 * written once. Once it's `answered`, the sheet closes and the line and the panel say what the
 * answer did (`SuggestionResult`), with Undo while it can be undone.
 *
 * ```tsx
 * <Suggestion answered={answered} label={t("Plan suggestion")}>
 *   <SuggestionLine>
 *     <SuggestionSummary>Make Saturday a rest day? You have a prep course then.</SuggestionSummary>
 *     <SuggestionOpen />
 *   </SuggestionLine>
 *
 *   <SuggestionContent>
 *     <SuggestionHeader>{t("Plan suggestion")}</SuggestionHeader>
 *     <SuggestionDescription>You have a prep course on Saturday mornings…</SuggestionDescription>
 *     <PlanEffectDiff effect={change.effect} />
 *     <SuggestionActions>
 *       <SuggestionAction onClick={apply}>{t("Apply")}</SuggestionAction>
 *       <SuggestionAction onClick={decline} variant="outline">{t("Not now")}</SuggestionAction>
 *     </SuggestionActions>
 *   </SuggestionContent>
 * </Suggestion>
 * ```
 */
export function Suggestion({
  answered = false,
  children,
  className,
  focusOnMount = false,
  label,
  mark,
  ...props
}: Omit<React.ComponentProps<"section">, "aria-label" | "ref"> & {
  /**
   * The learner answered: the sheet closes and focus moves to the suggestion. `true`, or the
   * answer's name ("applied", then "undone"), so a second answer such as Undo keeps focus too.
   */
  answered?: Answered;
  /** It replaced an answered suggestion in place ("Next suggestion"), so the keyboard lands on it. */
  focusOnMount?: boolean;
  /** Its accessible name, and its sheet's: "Plan suggestion", "What changed". */
  label: string;
  /** The kind's icon, drawn muted; the amber sparkle when it's a suggestion (the default). */
  mark?: React.ReactNode;
}) {
  const section = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [settled, setSettled] = useState(answered);

  // An answer closes the sheet it was given in; the line then says what it did.
  if (answered !== settled) {
    setSettled(answered);

    if (answered) {
      setOpen(false);
    }
  }

  useFocusOnAnswer({ answered, focusOnMount, section });
  useFocusOnRemovedControl(section);

  return (
    <SuggestionContext value={{ answered: Boolean(answered), label, mark, section }}>
      <Drawer onOpenChange={setOpen} open={open}>
        <section
          aria-label={label}
          className={cn(
            "focus-visible:ring-ring/50 flex min-w-0 flex-col rounded-xl outline-none focus-visible:ring-[3px]",
            className,
          )}
          data-slot="suggestion"
          ref={section}
          tabIndex={-1}
          {...props}
        >
          {children}
        </section>
      </Drawer>
    </SuggestionContext>
  );
}

/** The suggestion's mark, sized for where it's drawn: amber for a suggestion, muted for a kind. */
function SuggestionMark() {
  const { mark } = useSuggestion();
  const presentation = use(PresentationContext);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center",
        mark ? "text-muted-foreground" : "text-warning",
        MARK_SIZE[presentation],
      )}
      data-slot="suggestion-mark"
    >
      {mark ?? <SparkleIcon />}
    </span>
  );
}

/**
 * The suggestion as one line under the page's work, under 72rem: its mark, one sentence
 * (`SuggestionSummary`, or `SuggestionResult` once answered) and one small action, usually
 * `SuggestionOpen`.
 */
export function SuggestionLine({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <PresentationContext value="line">
      <div
        className={cn(
          FRAME_CLASS,
          "flex min-h-12 items-center gap-2.5 py-2 pr-2 pl-3",
          LINE_CLASS,
          className,
        )}
        data-slot="suggestion-line"
        {...props}
      >
        <SuggestionMark />
        {children}
      </div>
    </PresentationContext>
  );
}

/** The line's one sentence: two lines at most, the sheet has the rest. */
export function SuggestionSummary({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground line-clamp-2 min-w-0 flex-1 text-[0.8125rem] leading-snug",
        className,
      )}
      data-slot="suggestion-summary"
      {...props}
    />
  );
}

/** "View" at the line's end: opens the whole suggestion in a sheet ("Upload", "Choose"). */
export function SuggestionOpen({ children }: { children?: React.ReactNode }) {
  const t = useExtracted();

  return (
    <DrawerTrigger render={<Button className="shrink-0" size="sm" variant="outline" />}>
      {children ?? t("View")}
    </DrawerTrigger>
  );
}

/**
 * Everything the suggestion says and asks, written once: from 72rem it's the panel, in the aside;
 * under it, the sheet "View" opens.
 */
export function SuggestionContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { answered, label, section } = useSuggestion();

  return (
    <>
      <PresentationContext value="panel">
        <div
          className={cn(FRAME_CLASS, "flex-col gap-2.5 p-3.5", PANEL_CLASS, className)}
          data-slot="suggestion-panel"
        >
          {children}
        </div>
      </PresentationContext>

      {/* Closed by an answer, the sheet hands focus to the suggestion: "View" is gone by then. */}
      <DrawerPopup aria-label={label} finalFocus={answered ? section : true}>
        <PresentationContext value="sheet">
          <DrawerContent
            className="flex flex-col gap-4 px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            data-slot="suggestion-sheet"
          >
            {children}
          </DrawerContent>
        </PresentationContext>
      </DrawerPopup>
    </>
  );
}

/** What the suggestion is ("Plan suggestion"), after its mark; it names the sheet too. */
export function SuggestionHeader({ children }: { children: React.ReactNode }) {
  const presentation = use(PresentationContext);

  if (presentation === "sheet") {
    return (
      <div className="flex items-center gap-2.5" data-slot="suggestion-header">
        <SuggestionMark />
        <DrawerTitle className="text-[1.0625rem] leading-snug font-semibold text-pretty">
          {children}
        </DrawerTitle>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2" data-slot="suggestion-header">
      <SuggestionMark />
      <h2 className="text-[0.8125rem] leading-snug font-semibold text-pretty">{children}</h2>
    </div>
  );
}

const DESCRIPTION_SIZE: Readonly<Record<Presentation, string>> = {
  line: "text-[0.8125rem] leading-snug",
  panel: "text-[0.78125rem] leading-normal",
  sheet: "text-[0.9375rem] leading-normal",
};

/** What it's about, in a sentence or two; a note under the diff ("Mock exams stay on Sundays."). */
export function SuggestionDescription({ className, ...props }: React.ComponentProps<"p">) {
  const presentation = use(PresentationContext);

  return (
    <p
      className={cn("text-muted-foreground text-pretty", DESCRIPTION_SIZE[presentation], className)}
      data-slot="suggestion-description"
      {...props}
    />
  );
}

const RESULT_SIZE: Readonly<Record<Presentation, string>> = {
  line: "min-w-0 flex-1 text-[0.8125rem] leading-snug",
  panel: "text-[0.8125rem] leading-snug",
  sheet: "text-[0.9375rem] leading-normal",
};

/** What the answer did, where the answers were: "Saturday is now a rest day." */
export function SuggestionResult({ className, ...props }: React.ComponentProps<"p">) {
  const presentation = use(PresentationContext);

  return (
    <p
      className={cn("font-medium text-pretty", RESULT_SIZE[presentation], className)}
      data-slot="suggestion-result"
      role="status"
      {...props}
    />
  );
}

/** Why an answer didn't save, under the answers. */
export function SuggestionError({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-destructive-text text-[0.8125rem] leading-snug", className)}
      data-slot="suggestion-error"
      role="alert"
      {...props}
    />
  );
}

const ACTIONS_CLASS: Readonly<Record<Presentation, string>> = {
  line: "flex shrink-0 items-center gap-2",
  panel: "flex flex-wrap items-center gap-2 pt-1",
  // The sheet's answers form its action bar: two side by side, the first (the main one) leading
  // and widest, in the order the panel has them; three or more stacked full width, the first on top.
  // A long first label ("Find the time that covers everything", longer still translated) wraps
  // onto a second line instead of running past a phone's edge.
  sheet:
    "flex gap-2 pt-1 [&>*:first-child]:h-auto [&>*:first-child]:min-h-11 [&>*:first-child]:min-w-0 [&>*:first-child]:flex-1 [&>*:first-child]:text-balance [&>*:first-child]:whitespace-normal has-[>:nth-child(3)]:flex-col",
};

/** The answers, the main one first: small in the panel, the sheet's 44px action bar under it. */
export function SuggestionActions({ className, ...props }: React.ComponentProps<"div">) {
  const presentation = use(PresentationContext);

  return (
    <div
      className={cn(ACTIONS_CLASS[presentation], "empty:hidden", className)}
      data-slot="suggestion-actions"
      {...props}
    />
  );
}

/** A button's size where it's drawn: 44px in the sheet, small beside the line's and panel's words. */
function useActionSize(): "lg" | "sm" {
  return use(PresentationContext) === "sheet" ? "lg" : "sm";
}

/** One answer ("Apply", "Not now", "Undo"): the main one is the default; the others `outline`. */
export function SuggestionAction({ size, ...props }: React.ComponentProps<typeof Button>) {
  const actionSize = useActionSize();
  return <Button focusableWhenDisabled size={size ?? actionSize} {...props} />;
}

/** An answer that opens another screen ("Open", "See Plus"), drawn as `SuggestionAction`. */
export function SuggestionLinkAction({
  className,
  variant = "default",
  ...props
}: LearnLinkComponentProps & { variant?: "default" | "outline" }) {
  const size = useActionSize();
  return <LearnLink className={cn(buttonVariants({ size, variant }), className)} {...props} />;
}
