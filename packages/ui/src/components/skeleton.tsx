import { cn } from "@zoonk/ui/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("bg-muted animate-pulse rounded-xl", className)}
      data-slot="skeleton"
      {...props}
    />
  );
}

export { Skeleton };
