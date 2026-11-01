import { TASK_COLUMN_CLASS } from "@zoonk/learn/task-layout";
import { cn } from "@zoonk/ui/lib/utils";

export function PlayerContentFrame({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn(TASK_COLUMN_CLASS, className)} data-slot="player-content-frame" {...props} />
  );
}

export const COLUMN_GHOST_ACTION_CLASS = "-ml-2.75 w-fit";

/** Below `lg` the word bank waits above the action bar, so it holds still under the thumb while the answer grows. */
export const FILL_FOR_WORD_BANK_CLASS = "max-lg:has-data-[slot=word-bank]:flex-1";

export function InteractiveStepLayout({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <PlayerContentFrame
      className={cn("flex flex-col gap-6 pt-4 pb-6", FILL_FOR_WORD_BANK_CLASS, className)}
      data-slot="interactive-step-layout"
      {...props}
    />
  );
}
