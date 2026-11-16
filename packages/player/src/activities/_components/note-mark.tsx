import { cn } from "@zoonk/ui/lib/utils";
import { ACTIVITY_COLOR } from "../_utils/activity-colors";

export type NoteMarkKind = "correct" | "heard" | "kept" | "missed" | "new" | "removed" | "wrong";

const OPEN = "bg-background";

const MARK_CLASSES: Record<NoteMarkKind, string> = {
  correct: ACTIVITY_COLOR.right.solid,
  heard: ACTIVITY_COLOR.data.solid,
  kept: ACTIVITY_COLOR.placed.solid,
  missed: cn(ACTIVITY_COLOR.missed.box, ACTIVITY_COLOR.missed.text, OPEN),
  new: ACTIVITY_COLOR.data.solid,
  removed: cn(ACTIVITY_COLOR.guess.box, ACTIVITY_COLOR.guess.text, OPEN),
  wrong: cn("border-destructive border-2", ACTIVITY_COLOR.wrong.text, OPEN),
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
