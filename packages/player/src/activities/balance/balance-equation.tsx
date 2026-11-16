import { cn } from "@zoonk/ui/lib/utils";

export function BalanceEquation({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "flex items-center justify-center gap-2 text-center text-2xl font-medium tabular-nums",
        className,
      )}
      {...props}
    />
  );
}
