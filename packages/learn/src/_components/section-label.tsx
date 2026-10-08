import { cn } from "@zoonk/ui/lib/utils";

/**
 * A small group's name inside a sheet, a step or a folded panel ("Skills", "Your mistakes"), in
 * the same quiet style as a page section's group labels. A page's own sections use `PageSection`.
 */
export function SectionLabel({ children, className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-muted-foreground text-[0.8125rem] font-medium", className)}
      data-slot="section-label"
      {...props}
    >
      {children}
    </h2>
  );
}
