import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { cn } from "@zoonk/ui/lib/utils";
import { EllipsisIcon } from "lucide-react";

export function DetailHero({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6",
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
      className={cn("flex min-w-0 flex-col gap-1", className)}
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
      className={cn("flex flex-wrap items-center gap-2 md:shrink-0", className)}
      data-slot="detail-actions"
      {...props}
    />
  );
}

/** As tall as the action beside it; alone beside the title, a small button's 30px. */
export const DETAIL_MENU_TRIGGER_CLASS =
  "[--control-size:--spacing(11)] only:rounded-md only:[--control-size:--spacing(7.5)]";

/** `size="sm"` is for a header whose actions are small buttons: the menu is 30px beside them too. */
export function DetailMenu({
  children,
  label,
  size,
}: {
  children: React.ReactNode;
  label: string;
  size?: "sm";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          size === "sm" ? (
            <Button size="icon-sm" variant="outline" />
          ) : (
            <Button className={DETAIL_MENU_TRIGGER_CLASS} size="icon" variant="outline" />
          )
        }
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
