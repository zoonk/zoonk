import { cn } from "@zoonk/ui/lib/utils";
import { CircleMinusIcon } from "lucide-react";
import { ProgressRing } from "../_components/progress-ring";
import { StatusMark } from "../_components/status-mark";

/** A topic just begun still shows a sliver of its ring. */
const MIN_RING_SHARE = 0.15;

export type TopicMarkState =
  | { kind: "known" | "notPlanned" | "studied" | "toStudy" }
  | { kind: "inProgress"; share: number };

/**
 * A topic's tick, as the subject's chapters mark theirs: studied or known, begun (a ring), to
 * study, or out of the plan.
 */
export function TopicMark({
  mark,
  small = false,
}: {
  mark: TopicMarkState | null;
  small?: boolean;
}) {
  if (mark?.kind === "studied" || mark?.kind === "known" || mark?.kind === "toStudy") {
    return (
      <StatusMark
        className={cn(small && "[&_svg]:size-3.5")}
        status={mark.kind === "toStudy" ? "todo" : "done"}
      />
    );
  }

  return (
    mark && (
      <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">
        {mark.kind === "inProgress" ? (
          <ProgressRing
            className={small ? "size-3" : "size-3.5"}
            share={Math.max(MIN_RING_SHARE, mark.share)}
          />
        ) : (
          <CircleMinusIcon
            className={cn("text-muted-foreground/70", small ? "size-3.5" : "size-4")}
          />
        )}
      </span>
    )
  );
}
