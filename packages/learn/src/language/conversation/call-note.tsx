import { cn } from "@zoonk/ui/lib/utils";
import { type ComponentProps } from "react";

export function CallNote({ children, className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground flex items-start gap-2 text-[0.8125rem] leading-relaxed text-pretty [&>svg]:mt-0.75 [&>svg]:size-3.5 [&>svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}
