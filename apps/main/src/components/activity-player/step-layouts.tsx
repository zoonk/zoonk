import { cn } from "@zoonk/ui/lib/utils";

export function StaticStepLayout({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("relative flex w-full max-w-2xl flex-1 flex-col", className)}
      data-slot="static-step-layout"
      {...props}
    />
  );
}

export function StaticStepVisual({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-1 items-center justify-center", className)}
      data-slot="static-step-visual"
      {...props}
    />
  );
}

export function StaticStepText({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-center", className)} data-slot="static-step-text" {...props} />;
}

export function InteractiveStepLayout({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full max-w-2xl flex-col gap-6", className)}
      data-slot="interactive-step-layout"
      {...props}
    />
  );
}
