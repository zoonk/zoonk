import { TASK_COLUMN_CLASS } from "@zoonk/learn/task-layout";
import { cn } from "@zoonk/ui/lib/utils";

export function PlayerContentFrame({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn(TASK_COLUMN_CLASS, className)} data-slot="player-content-frame" {...props} />
  );
}

export const COLUMN_GHOST_ACTION_CLASS = "-ml-2.75 w-fit";

export function InteractiveStepLayout({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <PlayerContentFrame
      className={cn("flex flex-col gap-6 pt-4 pb-6", className)}
      data-slot="interactive-step-layout"
      {...props}
    />
  );
}
