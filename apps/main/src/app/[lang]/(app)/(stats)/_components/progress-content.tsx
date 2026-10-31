import { cn } from "@zoonk/ui/lib/utils";

export function ProgressContent({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-8", className)} data-slot="progress-content" {...props}>
      {children}
    </div>
  );
}
