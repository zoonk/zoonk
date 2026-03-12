import { cn } from "@zoonk/ui/lib/utils";

export function InteractiveStepLayout({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full max-w-2xl flex-col gap-4 sm:gap-6", className)}
      data-slot="interactive-step-layout"
      {...props}
    />
  );
}
