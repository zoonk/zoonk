import { cn } from "@zoonk/ui/lib/utils";

export function SectionLabel({ children, className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2 className={cn("text-label", className)} data-slot="section-label" {...props}>
      {children}
    </h2>
  );
}
