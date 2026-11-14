import { cn } from "@zoonk/ui/lib/utils";
import { PAGE_HEADER_CLASS } from "./page-header-class";

export function DetailHero({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn(PAGE_HEADER_CLASS, "gap-4", className)}
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
