import { cn } from "@zoonk/ui/lib/utils";

/**
 * A label that changes with its control's state ("Copy", "Copied") without changing the control's
 * width: every label takes the same cell and only the current one shows (craft X3). An `icon`
 * swaps with each label, so the icon and the label are centered together in the widest one's room,
 * and the control's gap stays between them.
 */
export function SwapLabel({
  current,
  icon,
  labels,
}: {
  current: string;
  icon?: React.ReactNode;
  labels: readonly string[];
}) {
  return (
    <span className={cn("inline-grid justify-items-center", icon && "gap-[inherit]")}>
      {labels.map((label) => (
        <span
          className={cn(
            "col-start-1 row-start-1",
            icon && "inline-flex items-center gap-[inherit]",
            label !== current && "invisible",
          )}
          key={label}
        >
          {icon && (
            <span className="inline-flex" data-icon="inline-start">
              {icon}
            </span>
          )}
          {label}
        </span>
      ))}
    </span>
  );
}
