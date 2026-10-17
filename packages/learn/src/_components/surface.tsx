import { cn } from "@zoonk/ui/lib/utils";

/**
 * A panel: a card with a hairline edge, a step lighter than the page in both themes, and no
 * shadow. Used sparingly, for one self-contained thing on a page (a preview, a sheet's group, an
 * explainer); most content sits right on the page, lists included. Never inside another panel.
 */
export const SURFACE_CLASS = "bg-card text-card-foreground ring-border rounded-xl ring-1";

export function Surface({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn(SURFACE_CLASS, className)} data-slot="surface" {...props} />;
}
