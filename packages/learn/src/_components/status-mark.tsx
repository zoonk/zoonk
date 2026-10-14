import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, FastForwardIcon } from "lucide-react";

type MarkStatus = "done" | "next" | "skipped" | "todo";

/**
 * The one mark for something done, wherever it shows: a chapter, a lesson, a phase, a mission, a
 * ticked routine, Today's blocks folded away. A green check, since green is progress made.
 * Decorative: the row's words or screen-reader text say it's done.
 */
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

/**
 * Where a thing in a list stands, the same everywhere (chapters, lessons, topics, phases), in the
 * quiet marks of Today's queue: a green check once done, a muted fast-forward once skipped because
 * the learner showed they know it, the learner's blue dot with a halo for the one to do next (where
 * they are; its row is highlighted too, in the neutral fill) and a faint dot ahead. The halo keeps
 * it from reading as a kind's dot. Every mark sits in one 16px box, so the rows' words start
 * in one place. `label` names the state for screen readers when the row doesn't say it in words.
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
        <span className="bg-selected ring-selected/25 size-2 rounded-full ring-3" />
      )}
      {status === "todo" && <span className="bg-foreground/20 size-2 rounded-full" />}
    </span>
  );
}
