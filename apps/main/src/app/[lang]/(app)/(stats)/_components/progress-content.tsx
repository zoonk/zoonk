import { cn } from "@zoonk/ui/lib/utils";

const SLOT = "progress-content";

/** For a chart's tooltip to stay inside this column, so it never leaves the page's gutter. */
export const PROGRESS_CONTENT_SELECTOR = `[data-slot="${SLOT}"]`;

export function ProgressContent({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-8", className)} data-slot={SLOT} {...props}>
      {children}
    </div>
  );
}
