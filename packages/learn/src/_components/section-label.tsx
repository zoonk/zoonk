import { cn } from "@zoonk/ui/lib/utils";

/**
 * A small group's name inside a sheet, a step or a folded panel ("SKILLS", "YOUR MISTAKES"), in
 * the same quiet label as a page section's title. A page's own sections use `PageSection`.
 */
export function SectionLabel({ children, className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2 className={cn("text-label", className)} data-slot="section-label" {...props}>
      {children}
    </h2>
  );
}
