import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, PlayIcon } from "lucide-react";

type MarkStatus = "done" | "next" | "todo";

/**
 * Where a thing in a list stands, the same everywhere (chapters, lessons, topics, choices): a
 * filled check once done, a filled play for the one to do next, an empty ring ahead. `label` names
 * the state for screen readers when the row doesn't say it in words.
 */
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
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full",
        status === "done" && "bg-success text-background",
        status === "next" && "bg-primary text-primary-foreground",
        status === "todo" && "border-foreground/15 border-2",
        className,
      )}
      data-slot="status-mark"
      role={label ? "img" : undefined}
    >
      {status === "done" && <CheckIcon aria-hidden="true" className="size-3.5" strokeWidth={3} />}
      {status === "next" && (
        <PlayIcon aria-hidden="true" className="size-3 translate-x-px fill-current" />
      )}
    </span>
  );
}
