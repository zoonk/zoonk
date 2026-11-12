import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";

export function Fold({
  children,
  className,
  isOpen,
  title,
}: React.PropsWithChildren<{ className?: string; isOpen?: boolean; title: string }>) {
  return (
    <details className={cn("group/fold", className)} open={isOpen}>
      <summary className="-ml-1 flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon
          aria-hidden="true"
          className="text-muted-foreground size-4 transition-transform group-open/fold:rotate-90"
        />
        {title}
      </summary>

      {children}
    </details>
  );
}
