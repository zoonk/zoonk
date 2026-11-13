import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { cn } from "@zoonk/ui/lib/utils";
import { EllipsisIcon } from "lucide-react";

/**
 * A "…" with no action beside it sits on the title's first line, at the column's end, at every
 * width. The small line above the title is always the header's first row, so the title is its
 * second.
 */
export function DetailHero({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "group/detail-hero flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6",
        "has-[>[data-slot=detail-actions]>[data-slot=dropdown-menu-trigger]:only-child]:grid has-[>[data-slot=detail-actions]>[data-slot=dropdown-menu-trigger]:only-child]:grid-cols-[minmax(0,1fr)_auto] has-[>[data-slot=detail-actions]>[data-slot=dropdown-menu-trigger]:only-child]:gap-x-4 has-[>[data-slot=detail-actions]>[data-slot=dropdown-menu-trigger]:only-child]:gap-y-1",
        className,
      )}
      data-slot="detail-hero"
      {...props}
    />
  );
}

export function DetailHeroText({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1",
        "group-has-[>[data-slot=detail-actions]>[data-slot=dropdown-menu-trigger]:only-child]/detail-hero:contents group-has-[>[data-slot=detail-actions]>[data-slot=dropdown-menu-trigger]:only-child]/detail-hero:*:col-start-1",
        className,
      )}
      data-slot="detail-hero-text"
      {...props}
    />
  );
}

export function DetailTitle({ children, className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      className={cn("text-title text-balance wrap-break-word", className)}
      data-slot="detail-title"
      {...props}
    >
      {children}
    </h1>
  );
}

export function DetailFacts({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-x-1.5 pt-1 font-mono text-xs wrap-anywhere tabular-nums",
        className,
      )}
      data-slot="detail-facts"
      {...props}
    />
  );
}

export function DetailActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 md:shrink-0",
        "has-[>[data-slot=dropdown-menu-trigger]:only-child]:col-start-2 has-[>[data-slot=dropdown-menu-trigger]:only-child]:row-start-2 has-[>[data-slot=dropdown-menu-trigger]:only-child]:mt-[0.09375rem] has-[>[data-slot=dropdown-menu-trigger]:only-child]:self-start",
        className,
      )}
      data-slot="detail-actions"
      {...props}
    />
  );
}

/** As tall as the action beside it; alone beside the title, a small button's 30px. */
export const DETAIL_MENU_TRIGGER_CLASS =
  "[--control-size:--spacing(11)] only:rounded-md only:[--control-size:--spacing(7.5)]";

export function DetailMenu({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button className={DETAIL_MENU_TRIGGER_CLASS} size="icon" variant="outline" />}
      >
        <EllipsisIcon aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
