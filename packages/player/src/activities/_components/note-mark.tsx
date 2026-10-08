import { cn } from "@zoonk/ui/lib/utils";

/**
 * How a note shows on an instrument: pressed by the learner (`new`), already there (`kept`),
 * taken away (`removed`), sounding (`heard`), and after a check right, wrong or missing.
 */
export type NoteMarkKind = "correct" | "heard" | "kept" | "missed" | "new" | "removed" | "wrong";

const MARK_CLASSES: Record<NoteMarkKind, string> = {
  correct: "bg-success text-background",
  heard: "bg-viz-accent text-background",
  kept: "bg-foreground text-background",
  missed: "border-success text-success bg-background border-2 border-dashed",
  new: "bg-viz-accent text-background",
  removed: "border-muted-foreground text-muted-foreground bg-background border-2 border-dashed",
  wrong: "border-destructive text-destructive bg-background border-2",
};

/** A note's name in a circle, drawn on a piano key or a guitar string. */
export function NoteMark({
  className,
  kind,
  label,
}: {
  className?: string;
  kind: NoteMarkKind;
  label: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
        MARK_CLASSES[kind],
        className,
      )}
      data-slot="note-mark"
    >
      {label}
    </span>
  );
}
