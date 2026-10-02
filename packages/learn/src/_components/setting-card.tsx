import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { type LucideIcon } from "lucide-react";

/**
 * A setting in its own card: the icon and a small control sit on the label's line and the
 * description wraps under the label, so long translations never pull them off the first line.
 */
export function SettingCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-border in-data-[mode=fun]:fun-glass flex items-start gap-3 rounded-2xl border p-4 text-base",
        className,
      )}
      data-slot="setting-card"
      {...props}
    />
  );
}

/** The setting's icon, centered on the label's line. */
export function SettingCardIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <LineMarker aria-hidden="true">
      <Icon className="text-muted-foreground size-5" />
    </LineMarker>
  );
}

/** The label and description column. */
export function SettingCardText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)}
      data-slot="setting-card-text"
      {...props}
    />
  );
}

/** The setting's name, on the card's line height so the icon and control line up with it. */
export function SettingCardLabel({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span className={cn("font-medium", className)} data-slot="setting-card-label" {...props} />
  );
}

export function SettingCardDescription({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="setting-card-description"
      {...props}
    />
  );
}

/** A small control, such as a switch, centered on the label's line. */
export function SettingCardControl({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("flex h-lh flex-none items-center", className)}
      data-slot="setting-card-control"
      {...props}
    />
  );
}
