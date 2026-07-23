import { cn } from "@zoonk/ui/lib/utils";

/**
 * Owns the vertical rhythm shared by every progress page, including streamed
 * fallbacks and empty states, so new metrics cannot drift from existing pages.
 */
export function ProgressContent({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-8", className)} data-slot="progress-content" {...props}>
      {children}
    </div>
  );
}
