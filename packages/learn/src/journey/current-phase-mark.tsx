import { cn } from "@zoonk/ui/lib/utils";

export function CurrentPhaseMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("bg-foreground ring-foreground/15 size-2.5 rounded-full ring-4", className)}
    />
  );
}
