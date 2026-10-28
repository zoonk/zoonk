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
import { createContext, use, useRef, useState } from "react";
import { type LearnLinkComponentProps } from "../learn-context";
import { LearnLink } from "../learn-link";
import { ChangeSaveError } from "./save-error";
import { type Answered, useFocusOnAnswer, useFocusOnRemovedControl } from "./suggestion-focus";
import { SURFACE_CLASS } from "./surface";

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

const FRAME_CLASS = cn(SURFACE_CLASS, "ring-inset");

const LINE_CLASS = "min-[72rem]:hidden";
const PANEL_CLASS = "hidden min-[72rem]:flex";

const MARK_SIZE: Readonly<Record<Presentation, string>> = {
  line: "[&>svg]:size-4",
  panel: "[&>svg]:size-3.5",
  sheet: "[&>svg]:size-5",
};

export function Suggestion({
  answered = false,
  children,
  className,
  focusOnMount = false,
  label,
  mark,
  ...props
}: Omit<React.ComponentProps<"section">, "aria-label" | "ref"> & {
  /** Pass the answer's name ("applied", then "undone"), so a second answer such as Undo moves focus too. */
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
          className={cn(FRAME_CLASS, "flex-col gap-2.5 p-3.5", PANEL_CLASS, className)}
          data-slot="suggestion-panel"
        >
          {children}
        </div>
      </PresentationContext>

      {/* Closed by an answer, the sheet hands focus to the suggestion, since "View" is gone by then. */}
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

export function SuggestionSaveError() {
  return <ChangeSaveError className="text-[0.8125rem] leading-snug" />;
}

const ACTIONS_CLASS: Readonly<Record<Presentation, string>> = {
  line: "flex shrink-0 items-center gap-2",
  panel: "flex flex-wrap items-center gap-2 pt-1",
  sheet:
    "flex gap-2 pt-1 [&>*:first-child]:h-auto [&>*:first-child]:min-h-11 [&>*:first-child]:min-w-0 [&>*:first-child]:flex-1 [&>*:first-child]:text-balance [&>*:first-child]:whitespace-normal has-[>:nth-child(3)]:flex-col",
};

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

function useActionSize(): "lg" | "sm" {
  return use(PresentationContext) === "sheet" ? "lg" : "sm";
}

export function SuggestionAction(props: Omit<React.ComponentProps<typeof Button>, "size">) {
  const size = useActionSize();
  return <Button focusableWhenDisabled size={size} {...props} />;
}

export function SuggestionLinkAction({
  className,
  variant = "default",
  ...props
}: LearnLinkComponentProps & { variant?: "default" | "outline" }) {
  const size = useActionSize();
  return <LearnLink className={cn(buttonVariants({ size, variant }), className)} {...props} />;
}
