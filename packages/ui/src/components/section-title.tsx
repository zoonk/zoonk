import { cn } from "@zoonk/ui/lib/utils";

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
