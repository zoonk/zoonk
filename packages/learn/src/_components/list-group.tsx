import { BusyIcon } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { type LearnLinkComponentProps } from "../learn-context";
import { LearnLink, type LearnPrefetch } from "../learn-link";
import { SURFACE_CLASS } from "./surface";
import { TITLE_ROW_CLASS } from "./title-row";

/** Rows are direct children, or the items of one `ol`/`ul` directly inside. */
export const LIST_GROUP_CLASS = "divided-rows flex flex-col";

/**
 * `overflow-clip`, not `overflow-hidden`: a scroll container would shrink to a line in a sheet's
 * flex column.
 */
const LIST_GROUP_PANEL_CLASS = cn(SURFACE_CLASS, LIST_GROUP_CLASS, "overflow-clip");

export function ListGroup({
  className,
  variant = "flat",
  ...props
}: React.ComponentProps<"div"> & { variant?: "flat" | "panel" }) {
  return (
    <div
      className={cn(variant === "panel" ? LIST_GROUP_PANEL_CLASS : LIST_GROUP_CLASS, className)}
      data-list={variant}
      data-slot="list-group"
      {...props}
    />
  );
}

export const LIST_ROW_CLASS = cn(
  "relative isolate flex w-full min-w-0 items-stretch gap-3 text-left",
  "aria-[current]:before:bg-muted data-highlighted:before:bg-muted before:pointer-events-none before:absolute before:-inset-x-2.5 before:inset-y-0.5 before:-z-10 before:rounded-lg before:transition-colors",
  "in-data-[list=panel]:px-4 in-data-[list=panel]:before:inset-0 in-data-[list=panel]:before:rounded-none",
);

export const LIST_ROW_INTERACTIVE_CLASS = cn(
  LIST_ROW_CLASS,
  "hover:before:bg-muted/70 active:before:bg-muted press focus-visible:before:ring-ring/50 outline-none select-none [--press-scale:0.99] focus-visible:before:ring-[3px]",
);

export const CURRENT_ROW_CLASS = "before:bg-muted hover:before:bg-muted";

/**
 * A row's trailing chevron, its ink on the row's end edge. The pull moves the glyph, not its place:
 * every glyph keeps a 16px slot, so the value before a ">" ends where the value before a fold arrow
 * does.
 */
export const ROW_CHEVRON_CLASS =
  "text-faint edge ms-(--edge-pull) -me-(--edge-pull) size-4 shrink-0 self-center";

/** The same chevron after a 12px line, such as a header's "1 of 4". */
export const SMALL_CHEVRON_CLASS =
  "edge -me-(--edge-pull) size-3.5 shrink-0 [--icon-size:--spacing(3.5)]";

export function ListRowChevron() {
  return <ChevronRightIcon aria-hidden="true" className={ROW_CHEVRON_CLASS} />;
}

/**
 * The chevron's slot, empty, at the end of a row that can't be opened: the value before it ends
 * where the other rows' values do.
 */
export function ListRowChevronSpace() {
  return <span aria-hidden="true" className="size-4 shrink-0" />;
}

export function ListRow({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn(LIST_ROW_CLASS, className)} data-slot="list-row" {...props} />;
}

export function ListRowLink({
  children,
  className,
  href,
  lessonWritten,
  onClick,
  prefetch,
}: {
  children: React.ReactNode;
  className?: string;
  href: string;
  lessonWritten?: boolean;
  onClick?: LearnLinkComponentProps["onClick"];
  prefetch?: LearnPrefetch;
}) {
  return (
    <LearnLink
      className={cn(LIST_ROW_INTERACTIVE_CLASS, className)}
      href={href}
      lessonWritten={lessonWritten}
      onClick={onClick}
      prefetch={prefetch}
    >
      {children}
      <BusyIcon className="text-muted-foreground self-center">
        <ListRowChevron />
      </BusyIcon>
    </LearnLink>
  );
}

/**
 * `disabled` keeps the row in focus, as Button's `focusableWhenDisabled` does, so a row waiting on
 * its press doesn't drop keyboard focus to the page.
 */
export function ListRowButton({
  children,
  className,
  chevron = true,
  disabled = false,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { chevron?: boolean }) {
  return (
    <button
      aria-disabled={disabled || undefined}
      className={cn(
        LIST_ROW_INTERACTIVE_CLASS,
        "group/busy aria-disabled:not-aria-busy:pointer-events-none",
        className,
      )}
      data-slot="list-row"
      onClick={disabled ? undefined : onClick}
      type="button"
      {...props}
    >
      {children}
      {chevron && (
        <BusyIcon className="text-muted-foreground self-center">
          <ListRowChevron />
        </BusyIcon>
      )}
    </button>
  );
}

export function ListRowLeading({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex min-w-4 shrink-0 items-center justify-center self-center empty:hidden",
        className,
      )}
      data-slot="list-row-leading"
      {...props}
    />
  );
}

export function ListRowIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "text-muted-foreground flex size-4 shrink-0 items-center justify-center self-center [&_svg]:size-4",
        className,
      )}
      data-slot="list-row-icon"
      {...props}
    />
  );
}

/** A row's `ListRowContent` and its `ListRowTrailing`, which goes in here so it can move under the content. */
export function ListRowBody({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        TITLE_ROW_CLASS,
        "min-h-11 min-w-0 flex-1 gap-y-0.5 py-2.75",
        "*:data-[slot=list-row-content]:min-h-0 *:data-[slot=list-row-content]:py-0",
        className,
      )}
      data-slot="list-row-body"
      {...props}
    />
  );
}

export function ListRowContent({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-px py-2.75",
        className,
      )}
      data-slot="list-row-content"
      {...props}
    />
  );
}

export function ListRowTitle({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-sm leading-snug font-medium text-pretty wrap-break-word", className)}
      data-slot="list-row-title"
      {...props}
    />
  );
}

/**
 * The number is the title's first word, so a numbered row's text starts on the edge every other
 * row's does, and a `description` starts there too.
 */
export function ListRowNumberedTitle({
  children,
  className,
  description,
  number,
  textClassName,
}: {
  children: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  number: number;
  textClassName?: string;
}) {
  return (
    <span className={cn("flex flex-col", className)}>
      <ListRowTitle className={textClassName}>
        <span className="text-muted-foreground me-1.5 font-mono text-xs font-normal tabular-nums">
          {`${number}.`}
        </span>
        {children}
      </ListRowTitle>
      {description && <span className="flex flex-col pt-px empty:hidden">{description}</span>}
    </span>
  );
}

export function ListRowDescription({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground text-xs leading-snug", className)}
      data-slot="list-row-description"
      {...props}
    />
  );
}

export function ListRowTrailing({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground flex min-w-0 items-center gap-2 font-mono text-xs tabular-nums",
        className,
      )}
      data-slot="list-row-trailing"
      {...props}
    />
  );
}
