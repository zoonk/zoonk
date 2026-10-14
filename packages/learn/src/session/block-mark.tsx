import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { KindMark } from "../_components/kind-tile";
import { DoneMark } from "../_components/status-mark";
import { getBlockKind } from "./block-kind";
import { type StudyBlock } from "./session-types";

/**
 * A block's mark in the day's queue, on Today and beside the session: its kind's icon, the
 * Trickster's face for a phase's challenge (he's its boss), the done mark every list shares once
 * done (`done` for a block that just ended on this screen, whose copy may still have it running)
 * and an empty ring once skipped.
 */
export function BlockMark({
  block,
  className,
  done = block.status === "completed",
}: {
  block: StudyBlock;
  className?: string;
  done?: boolean;
}) {
  if (done) {
    return <DoneMark className={cn("size-3.5", className)} />;
  }

  if (block.status === "skipped") {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "ring-muted-foreground/50 size-2 shrink-0 rounded-full ring-[1.5px] ring-inset",
          className,
        )}
      />
    );
  }

  // The Trickster is a phase's boss: the week's challenge wears its kind's icon.
  if (block.checkpoint && !block.checkpoint.mock && block.checkpoint.kind !== "weekly") {
    return <Trickster className={cn("-m-1 size-5", className)} />;
  }

  return <KindMark className={className} kind={getBlockKind(block)} />;
}
