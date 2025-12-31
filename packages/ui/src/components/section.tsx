import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";

export type SectionTitleProps = React.ComponentProps<"h2">;

export function SectionTitle({ children, className }: SectionTitleProps) {
  return (
    <h2
      className={cn(
        "font-medium text-muted-foreground text-sm tracking-tight",
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function SectionHeader({
  children,
  className,
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group/section-header flex items-center justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeaderContent({
  children,
  className,
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>{children}</div>
  );
}

export function SectionHeaderIcon({
  children,
  className,
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 text-muted-foreground/50 transition-colors group-hover/section-header:text-muted-foreground [&>svg]:size-4",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeaderLabel({
  children,
  className,
}: React.ComponentProps<"span">) {
  return (
    <span className={cn("truncate font-light text-sm", className)}>
      {children}
    </span>
  );
}

export function SectionHeaderIndicator({
  className,
}: React.ComponentProps<"span">) {
  return (
    <ChevronRightIcon
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover/section-header:text-muted-foreground",
        className,
      )}
    />
  );
}
