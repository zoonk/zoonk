import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon } from "lucide-react";

export function SuccessEyebrow({ children, className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-success-text flex items-center gap-1.5 text-sm font-medium", className)}
      data-slot="success-eyebrow"
      {...props}
    >
      <CheckIcon aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </p>
  );
}
