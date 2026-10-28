import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { type LearnLinkComponentProps } from "../learn-context";
import { LearnLink } from "../learn-link";
import { SURFACE_CLASS } from "./surface";

/**
 * The one list on every page: rows flat on the page with a hairline between them, as wide as the
 * column. A row in view (`aria-current`, or `data-highlighted` where it isn't the current one) or
 * under the pointer is highlighted a little past the column's edges, and the highlighted row's
 * hairlines turn transparent (`divided-rows`). `variant="panel"` puts the rows on one panel
 * instead, for the rare list that is a self-contained thing (inside a sheet, beside other panels).
 * Rows are direct children, or the items of one `ol`/`ul` directly inside: an item that wraps its
 * row carries the row's mark.
 *
 * ```tsx
 * <ListGroup>
 *   <ListRowLink href="/mistakes">
 *     <ListRowLeading><KindDot kind="mistakes" /></ListRowLeading>
 *     <ListRowContent>
 *       <ListRowTitle>Mistakes notebook</ListRowTitle>
 *       <ListRowDescription>Redo what you got wrong</ListRowDescription>
 *     </ListRowContent>
 *     <ListRowTrailing>14</ListRowTrailing>
 *   </ListRowLink>
 * </ListGroup>
 * ```
 *
 * The panel clips its corners without becoming a scroll container (`overflow-clip`, not
 * `overflow-hidden`), so inside a sheet's flex column it keeps its rows' height instead of
 * shrinking to a line.
 */
export const LIST_GROUP_CLASS = "divided-rows flex flex-col";

/** The list on a panel, its rows inset from the panel's edge. */
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

/**
 * A row's frame: leading, content and trailing side by side, the content setting the height. Its
 * highlight (in view, under the pointer) is drawn behind it, a little past the column's edges on
 * the page and edge to edge on a panel, so the hairlines between rows keep the column's width.
 */
export const LIST_ROW_CLASS = cn(
  "relative isolate flex w-full min-w-0 items-stretch gap-3 text-left",
  "aria-[current]:before:bg-muted data-highlighted:before:bg-muted before:pointer-events-none before:absolute before:-inset-x-2.5 before:inset-y-0.5 before:-z-10 before:rounded-[0.625rem] before:transition-colors",
  "in-data-[list=panel]:px-4 in-data-[list=panel]:before:inset-0 in-data-[list=panel]:before:rounded-none",
);

/**
 * A row that opens or does something: the hover, the press and the keyboard focus inside the list.
 * All are drawn on the highlight, which has the radius, so the row itself stays square and the
 * hairline between rows runs straight to the column's edges; a press also gives way as a wide
 * option does, so a tap shows before the next page does.
 */
export const LIST_ROW_INTERACTIVE_CLASS = cn(
  LIST_ROW_CLASS,
  "hover:before:bg-muted/70 active:before:bg-muted press focus-visible:before:ring-ring/50 outline-none [--press-scale:0.99] focus-visible:before:ring-[3px]",
);

/**
 * The row the learner is on, for a row that marks it without `aria-current` (the next chapter, the
 * mock to take next): the same highlight, kept under the pointer. Its list item carries
 * `aria-current`, which drops the hairlines around it.
 */
export const CURRENT_ROW_CLASS = "before:bg-muted hover:before:bg-muted";

/** The row's way forward, after its trailing content. */
function ListRowChevron({ className }: { className?: string }) {
  return (
    <ChevronRightIcon
      aria-hidden="true"
      className={cn("text-muted-foreground/60 size-4 shrink-0 self-center", className)}
    />
  );
}

/** A row that only shows something. */
export function ListRow({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn(LIST_ROW_CLASS, className)} data-slot="list-row" {...props} />;
}

/** A row opening another page, the whole row being the link. */
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
  /** As `LearnLink`'s: runs before the host navigates. */
  onClick?: LearnLinkComponentProps["onClick"];
  /** As `LearnLink`'s: `"auto"` for a destination that writes itself when opened. */
  prefetch?: boolean | "auto";
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
      <ListRowChevron />
    </LearnLink>
  );
}

/** A row opening something in place (a sheet, more rows) or acting, the whole row being the button. */
export function ListRowButton({
  children,
  className,
  chevron = true,
  ...props
}: React.ComponentProps<"button"> & { chevron?: boolean }) {
  return (
    <button
      className={cn(LIST_ROW_INTERACTIVE_CLASS, className)}
      data-slot="list-row"
      type="button"
      {...props}
    >
      {children}
      {chevron && <ListRowChevron />}
    </button>
  );
}

/** The row's icon, tile, mark or picture; one left empty (a topic without a status) takes no room. */
export function ListRowLeading({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("flex shrink-0 items-center self-center empty:hidden", className)}
      data-slot="list-row-leading"
      {...props}
    />
  );
}

/** A row's icon as its leading: a quiet 16px glyph, no tile. A thing with a kind takes its dot. */
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

/** The title and its lines. */
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
      className={cn("text-sm leading-snug font-medium text-pretty", className)}
      data-slot="list-row-title"
      {...props}
    />
  );
}

/**
 * A numbered row's title: its place ("2.") hung before the words in the mono face, so a long title
 * wraps under its own first word, never under the number. `textClassName` reaches the words (a
 * clamp, a muted done row).
 */
export function ListRowNumberedTitle({
  children,
  className,
  number,
  textClassName,
}: {
  children: React.ReactNode;
  className?: string;
  number: number;
  textClassName?: string;
}) {
  return (
    <ListRowTitle className={cn("flex items-baseline gap-1.5", className)}>
      <span className="text-muted-foreground shrink-0 font-mono text-xs font-normal tabular-nums">
        {`${number}.`}
      </span>
      <span className={cn("min-w-0", textClassName)}>{children}</span>
    </ListRowTitle>
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

/**
 * A count, a time or a date at the row's end, before its chevron, in the mono face. A word there
 * (a chip, a status) takes `font-sans` back.
 */
export function ListRowTrailing({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground flex shrink-0 items-center gap-2 self-center font-mono text-xs tabular-nums",
        className,
      )}
      data-slot="list-row-trailing"
      {...props}
    />
  );
}
