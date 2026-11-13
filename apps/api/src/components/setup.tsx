import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";

export function Setup({ children, className }: React.ComponentProps<"div">) {
  return <div className={cn("flex w-full flex-col gap-6", className)}>{children}</div>;
}

export function SetupFormSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-1.5">
      <div className="grid gap-3">
        <Skeleton className="h-4 w-16 rounded-md" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>

      <div className="h-5" />
      <Skeleton className="h-11 w-full rounded-lg" />
    </div>
  );
}
