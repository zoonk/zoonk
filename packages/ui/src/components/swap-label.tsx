import { cn } from "@zoonk/ui/lib/utils";

/**
 * A label that changes with its control's state ("Copy", "Copied") without changing the control's
 * width: every label takes the same cell and only the current one shows (craft X3).
 */
export function SwapLabel({ current, labels }: { current: string; labels: readonly string[] }) {
  return (
    <span className="inline-grid justify-items-center">
      {labels.map((label) => (
        <span
          className={cn("col-start-1 row-start-1", label !== current && "invisible")}
          key={label}
        >
          {label}
        </span>
      ))}
    </span>
  );
}
