import { cn } from "@zoonk/ui/lib/utils";

/** The small quiet caps above a group of a screen, such as "This week" or "Your mistakes". */
export function SectionLabel({ children, className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-muted-foreground text-xs font-medium tracking-wide uppercase", className)}
      data-slot="section-label"
      {...props}
    >
      {children}
    </h2>
  );
}
