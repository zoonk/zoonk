import { cn } from "@zoonk/ui/lib/utils";

export function NavigableStepLayout({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative flex min-h-0 w-full max-w-5xl min-w-0 flex-1 justify-center",
        className,
      )}
      data-slot="navigable-step-layout"
      {...props}
    />
  );
}

export function InteractiveStepLayout({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("my-auto flex w-full max-w-2xl flex-col gap-4 sm:gap-6", className)}
      data-slot="interactive-step-layout"
      {...props}
    />
  );
}
