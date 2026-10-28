import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { type LearnLinkComponentProps } from "../learn-context";
import { LearnLink } from "../learn-link";
import { SURFACE_CLASS } from "./surface";

/** Rows are direct children, or the items of one `ol`/`ul` directly inside. */
export const LIST_GROUP_CLASS = "divided-rows flex flex-col";

/** `overflow-clip`, not `overflow-hidden`: a scroll container would shrink to a line in a sheet's flex column. */
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
  "aria-[current]:before:bg-muted data-highlighted:before:bg-muted before:pointer-events-none before:absolute before:-inset-x-2.5 before:inset-y-0.5 before:-z-10 before:rounded-[0.625rem] before:transition-colors",
  "in-data-[list=panel]:px-4 in-data-[list=panel]:before:inset-0 in-data-[list=panel]:before:rounded-none",
);

export const LIST_ROW_INTERACTIVE_CLASS = cn(
  LIST_ROW_CLASS,
  "hover:before:bg-muted/70 active:before:bg-muted press focus-visible:before:ring-ring/50 outline-none [--press-scale:0.99] focus-visible:before:ring-[3px]",
);

export const CURRENT_ROW_CLASS = "before:bg-muted hover:before:bg-muted";

function ListRowChevron({ className }: { className?: string }) {
  return (
    <ChevronRightIcon
      aria-hidden="true"
      className={cn("text-muted-foreground/60 size-4 shrink-0 self-center", className)}
    />
  );
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

export function ListRowLeading({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("flex shrink-0 items-center self-center empty:hidden", className)}
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
