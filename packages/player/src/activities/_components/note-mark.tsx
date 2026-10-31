import { cn } from "@zoonk/ui/lib/utils";

export type NoteMarkKind = "correct" | "heard" | "kept" | "missed" | "new" | "removed" | "wrong";

const MARK_CLASSES: Record<NoteMarkKind, string> = {
  correct: "bg-success-text text-background",
  heard: "bg-viz-accent text-background",
  kept: "bg-foreground text-background",
  missed: "border-success text-success-text bg-background border-2 border-dashed",
  new: "bg-viz-accent text-background",
  removed: "border-muted-foreground text-muted-foreground bg-background border-2 border-dashed",
  wrong: "border-destructive text-destructive-text bg-background border-2",
};

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
        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
        MARK_CLASSES[kind],
        className,
      )}
      data-slot="note-mark"
    >
      {label}
    </span>
  );
}
