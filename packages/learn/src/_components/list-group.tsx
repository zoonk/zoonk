import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { LearnLink } from "../learn-link";
import { SURFACE_CLASS } from "./surface";

/**
 * The one list on every page: rows on one surface, set apart by their spacing and their leading
 * marks rather than lines between them, so a long list stays calm. Rows are direct children, or the
 * items of one `ol`/`ul` directly inside.
 *
 * ```tsx
 * <ListGroup>
 *   <ListRowLink href="/mistakes">
 *     <ListRowLeading><KindTile kind="mistakes" /></ListRowLeading>
 *     <ListRowContent>
 *       <ListRowTitle>Mistakes notebook</ListRowTitle>
 *       <ListRowDescription>Redo what you got wrong</ListRowDescription>
 *     </ListRowContent>
 *     <ListRowTrailing>14</ListRowTrailing>
 *   </ListRowLink>
 * </ListGroup>
 * ```
 */
export const LIST_GROUP_CLASS = cn(SURFACE_CLASS, "flex flex-col overflow-hidden");

export function ListGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn(LIST_GROUP_CLASS, className)} data-slot="list-group" {...props} />;
}

/** A row's frame: leading, content and trailing side by side, the content setting the height. */
export const LIST_ROW_CLASS =
  "relative flex w-full min-w-0 items-stretch gap-3 px-4 text-left aria-[current]:bg-muted/50";

/** A row that opens or does something: the hover and the keyboard focus inside the list. */
export const LIST_ROW_INTERACTIVE_CLASS = cn(
  LIST_ROW_CLASS,
  "hover:bg-muted/50 focus-visible:ring-ring/50 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-inset",
);

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
  prefetch,
}: {
  children: React.ReactNode;
  className?: string;
  href: string;
  /** As `LearnLink`'s: `"auto"` for a destination that writes itself when opened. */
  prefetch?: boolean | "auto";
}) {
  return (
    <LearnLink
      className={cn(LIST_ROW_INTERACTIVE_CLASS, className)}
      href={href}
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

/** A row's icon on a neutral tile, as its leading; tint it with `className`. */
export function ListRowIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center self-center rounded-xl [&_svg]:size-5",
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
        "flex min-h-14 min-w-0 flex-1 flex-col justify-center gap-0.5 py-3.5",
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
      className={cn("text-[0.9375rem] leading-snug font-medium text-pretty", className)}
      data-slot="list-row-title"
      {...props}
    />
  );
}

export function ListRowDescription({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground text-[0.8125rem] leading-snug", className)}
      data-slot="list-row-description"
      {...props}
    />
  );
}

/** A count, a date or a pill at the row's end, before its chevron. */
export function ListRowTrailing({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground flex shrink-0 items-center gap-2 self-center text-sm tabular-nums",
        className,
      )}
      data-slot="list-row-trailing"
      {...props}
    />
  );
}
