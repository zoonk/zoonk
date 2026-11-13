"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerCloseButton,
  DrawerContent,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@zoonk/ui/components/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import { SparkleIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { createContext, use, useRef, useState } from "react";
import { type LearnLinkComponentProps } from "../learn-context";
import { LearnLink } from "../learn-link";
import { ChangeSaveError } from "./save-error";
import { type Answered, useFocusOnAnswer, useFocusOnRemovedControl } from "./suggestion-focus";
import { SURFACE_CLASS } from "./surface";
import { TITLE_ROW_CLASS } from "./title-row";

type Presentation = "line" | "panel" | "sheet";

type SuggestionValue = {
  answered: boolean;
  label: string;
  mark: React.ReactNode;
  section: React.RefObject<HTMLElement | null>;
  setOpen: (open: boolean) => void;
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

const FRAME_CLASS = SURFACE_CLASS;

const LINE_CLASS = "min-[72rem]:hidden";
const PANEL_CLASS = "hidden min-[72rem]:flex";

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
   * Pass the answer's name ("applied", then "undone"), so a second answer such as Undo moves focus
   * too.
   */
  answered?: Answered;
  focusOnMount?: boolean;
  label: string;
  mark?: React.ReactNode;
}) {
  const section = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [settled, setSettled] = useState(answered);

  if (answered !== settled) {
    setSettled(answered);

    if (answered) {
      setOpen(false);
    }
  }

  useFocusOnAnswer({ answered, focusOnMount, section });
  useFocusOnRemovedControl(section);

  return (
    <SuggestionContext value={{ answered: Boolean(answered), label, mark, section, setOpen }}>
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

function SuggestionMark() {
  const { mark } = useSuggestion();

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center [&>svg]:size-4",
        mark ? "text-muted-foreground" : "text-warning",
      )}
      data-slot="suggestion-mark"
    >
      {mark ?? <SparkleIcon />}
    </span>
  );
}

export function SuggestionLine({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <PresentationContext value="line">
      <div
        className={cn(
          FRAME_CLASS,
          "flex min-h-12 items-center gap-3 py-2 pr-2 pl-4",
          LINE_CLASS,
          className,
        )}
        data-slot="suggestion-line"
        {...props}
      >
        <SuggestionMark />
        <form className={cn(TITLE_ROW_CLASS, "min-w-0 flex-1 gap-x-2.5 gap-y-2")}>{children}</form>
      </div>
    </PresentationContext>
  );
}

export function SuggestionSummary({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "stacked:line-clamp-none line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-medium text-pretty",
        className,
      )}
      data-slot="suggestion-summary"
      {...props}
    />
  );
}

/**
 * A suggestion's main action on a page that has its own (Today's "Start session"): filled in the
 * sheet, which covers the page, and outline in the panel beside it, so the page keeps one filled
 * button.
 */
export function useMainActionVariant(): "default" | "outline" {
  return use(PresentationContext) === "panel" ? "outline" : "default";
}

export function useCloseSuggestionSheet(): () => void {
  const { setOpen } = useSuggestion();
  return () => setOpen(false);
}

export function SuggestionOpen({ children }: { children?: React.ReactNode }) {
  const t = useExtracted();

  return (
    <DrawerTrigger render={<Button className="shrink-0" size="sm" variant="outline" />}>
      {children ?? t("View")}
    </DrawerTrigger>
  );
}

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
          className={cn(FRAME_CLASS, "flex-col gap-2.5 p-4", PANEL_CLASS, className)}
          data-slot="suggestion-panel"
        >
          {children}
        </div>
      </PresentationContext>

      {/* Closed by an answer, the sheet hands focus to the suggestion, since "View" is gone by
          then. */}
      <DrawerPopup aria-label={label} finalFocus={answered ? section : true}>
        <PresentationContext value="sheet">
          <DrawerContent
            className="flex flex-col gap-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            data-slot="suggestion-sheet"
          >
            {children}
          </DrawerContent>
        </PresentationContext>
      </DrawerPopup>
    </>
  );
}

/**
 * The title starts on the edge the lines and buttons under it start on: the kind's mark stays with
 * the one-line form, where it leads the row.
 */
export function SuggestionHeader({ children }: { children: React.ReactNode }) {
  const t = useExtracted();
  const presentation = use(PresentationContext);

  if (presentation === "sheet") {
    return (
      <div className="flex items-start gap-3" data-slot="suggestion-header">
        <DrawerTitle className="min-w-0 flex-1 text-pretty">{children}</DrawerTitle>
        <DrawerCloseButton label={t("Close")} />
      </div>
    );
  }

  return (
    <h2
      className="text-compact leading-snug font-semibold text-pretty"
      data-slot="suggestion-header"
    >
      {children}
    </h2>
  );
}

const DESCRIPTION_SIZE: Readonly<Record<Presentation, string>> = {
  line: "text-compact leading-snug",
  panel: "text-xs leading-normal",
  sheet: "text-reading leading-normal",
};

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
  line: "min-w-0 flex-1 text-compact leading-snug",
  panel: "text-compact leading-snug",
  sheet: "text-reading leading-normal",
};

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

export function SuggestionSaveError({ className }: { className?: string }) {
  return <ChangeSaveError className={cn("text-compact leading-snug", className)} />;
}

/** In the panel each button fills its share of a row, so buttons that wrap stack at one width. */
const ACTIONS_CLASS: Readonly<Record<Presentation, string>> = {
  line: "flex shrink-0 items-center gap-2",
  panel:
    "flex flex-wrap items-center gap-2 pt-1 [&>*]:h-auto [&>*]:min-h-7.5 [&>*]:max-w-full [&>*]:grow [&>*]:py-1 [&>*]:text-balance [&>*]:whitespace-normal",
  sheet:
    "flex gap-2 pt-1 [&>*:first-child]:h-auto [&>*:first-child]:min-h-11 [&>*:first-child]:min-w-0 [&>*:first-child]:flex-1 [&>*:first-child]:text-center [&>*:first-child]:text-balance [&>*:first-child]:whitespace-normal has-[>:nth-child(3_of_a,button)]:flex-col",
};

export function SuggestionActions({ className, ...props }: React.ComponentProps<"form">) {
  const presentation = use(PresentationContext);

  return (
    <form
      className={cn(ACTIONS_CLASS[presentation], "empty:hidden", className)}
      data-slot="suggestion-actions"
      {...props}
    />
  );
}

function useActionSize(): "lg" | "sm" {
  return use(PresentationContext) === "sheet" ? "lg" : "sm";
}

/**
 * An `action` submits the `SuggestionLine` or `SuggestionActions` form around it, so React holds a press made before
 * the page hydrates and sends it once it does, where a press on `onClick` is lost.
 */
export function SuggestionAction({
  action,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "formAction" | "size" | "type"> & {
  action?: () => void;
}) {
  const size = useActionSize();

  return (
    <Button
      focusableWhenDisabled
      formAction={action && (() => action())}
      size={size}
      type={action ? "submit" : "button"}
      {...props}
    />
  );
}

export function SuggestionLinkAction({
  className,
  variant = "default",
  ...props
}: LearnLinkComponentProps & { variant?: "default" | "outline" }) {
  const size = useActionSize();
  return <LearnLink className={cn(buttonVariants({ size, variant }), className)} {...props} />;
}
