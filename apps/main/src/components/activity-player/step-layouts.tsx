import { cn } from "@zoonk/ui/lib/utils";

export function StaticStepLayout({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full max-w-2xl flex-1 flex-col", className)}
      data-slot="static-step-layout"
      {...props}
    />
  );
}

export function StaticStepVisual({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 xl:max-h-[50vh] xl:flex-initial xl:py-10",
        className,
      )}
      data-slot="static-step-visual"
      {...props}
    />
  );
}

export function StaticStepText({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1 text-left", className)}
      data-slot="static-step-text"
      {...props}
    />
  );
}

export function InteractiveStepLayout({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full max-w-2xl flex-col gap-4 sm:gap-6", className)}
      data-slot="interactive-step-layout"
      {...props}
    />
  );
}
