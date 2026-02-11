import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";

export function PlayerActionBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-background/95 sticky bottom-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm",
        className,
      )}
      data-slot="player-action-bar"
      {...props}
    />
  );
}

export function PlayerActionButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn("w-full", className)}
      data-slot="player-action-button"
      size="lg"
      {...props}
    />
  );
}
