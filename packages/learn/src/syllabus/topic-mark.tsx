import { cn } from "@zoonk/ui/lib/utils";
import { CircleMinusIcon } from "lucide-react";
import { ProgressRing } from "../_components/progress-ring";
import { StatusMark } from "../_components/status-mark";

/** A topic just begun still shows a sliver of its ring. */
const MIN_RING_SHARE = 0.15;

export type TopicMarkState =
  | { kind: "notPlanned" | "studied" | "toStudy" }
  | { kind: "inProgress"; share: number };

/** A topic's tick, as the subject's chapters mark theirs: studied, begun (a ring), to study, or out of the plan. */
export function TopicMark({
  mark,
  small = false,
}: {
  mark: TopicMarkState | null;
  small?: boolean;
}) {
  if (mark?.kind === "studied" || mark?.kind === "toStudy") {
    return (
      <StatusMark
        className={cn(small && "size-4.5 [&_svg]:size-3")}
        status={mark.kind === "studied" ? "done" : "todo"}
      />
    );
  }

  return (
    mark && (
      <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center">
        {mark.kind === "inProgress" ? (
          <ProgressRing
            className={small ? "size-4" : "size-5"}
            share={Math.max(MIN_RING_SHARE, mark.share)}
          />
        ) : (
          <CircleMinusIcon
            className={cn("text-muted-foreground/70", small ? "size-4.5" : "size-6")}
          />
        )}
      </span>
    )
  );
}
