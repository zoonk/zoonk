import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, FastForwardIcon } from "lucide-react";

type MarkStatus = "done" | "next" | "skipped" | "todo";

export function DoneMark({ className }: { className?: string }) {
  return (
    <CheckIcon
      aria-hidden="true"
      className={cn("text-success size-4 shrink-0", className)}
      data-slot="done-mark"
      strokeWidth={2.5}
    />
  );
}

export function StatusMark({
  className,
  label,
  status,
}: {
  className?: string;
  label?: string;
  status: MarkStatus;
}) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("flex size-4 shrink-0 items-center justify-center", className)}
      data-slot="status-mark"
      data-status={status}
      role={label ? "img" : undefined}
    >
      {status === "done" && <DoneMark />}
      {status === "skipped" && (
        <FastForwardIcon aria-hidden="true" className="text-muted-foreground size-3 fill-current" />
      )}
      {status === "next" && (
        <span className="bg-success ring-success/25 size-2 rounded-full ring-3" />
      )}
      {status === "todo" && <span className="bg-foreground/20 size-2 rounded-full" />}
    </span>
  );
}
