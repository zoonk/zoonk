import { cn } from "@zoonk/ui/lib/utils";

/**
 * The one container for grouped content on every page: a card with a hairline edge, white on a
 * white page in light and a step lighter than the page in dark (main's look). Lists, notices,
 * stat cards and the session all sit on it; nothing else draws a box around content.
 */
export const SURFACE_CLASS = "bg-card text-card-foreground ring-foreground/10 rounded-2xl ring-1";

export function Surface({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn(SURFACE_CLASS, className)} data-slot="surface" {...props} />;
}
