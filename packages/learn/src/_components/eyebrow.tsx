import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon } from "lucide-react";

const EYEBROW_TONE = {
  neutral: "text-muted-foreground ring-border",
  success: "text-success-text ring-success/40",
};

/**
 * The small line over a title is this chip on every screen that has one. It holds a label: a
 * sentence or a control goes beside it or under the title.
 */
export function Eyebrow({
  children,
  className,
  icon,
  tone = "neutral",
  ...props
}: React.ComponentProps<"p"> & { icon?: React.ReactNode; tone?: keyof typeof EYEBROW_TONE }) {
  return (
    <p
      className={cn(
        "inline-flex min-h-5.5 w-fit max-w-full items-start gap-1.5 rounded-sm px-2 py-0.75 text-xs font-medium text-pretty ring-1 ring-inset [&_svg]:size-3.5",
        EYEBROW_TONE[tone],
        className,
      )}
      data-slot="eyebrow"
      {...props}
    >
      {icon && <LineMarker>{icon}</LineMarker>}
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export function SuccessEyebrow({
  iconClassName,
  ...props
}: Omit<React.ComponentProps<typeof Eyebrow>, "icon" | "tone"> & { iconClassName?: string }) {
  return (
    <Eyebrow
      icon={<CheckIcon aria-hidden="true" className={iconClassName} />}
      tone="success"
      {...props}
    />
  );
}
