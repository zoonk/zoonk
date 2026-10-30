import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@zoonk/ui/lib/utils";

export function Stat({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "ring-border rounded-option flex min-w-0 flex-col gap-1.5 p-3 text-left ring-1 ring-inset",
          className,
        ),
      },
      props,
    ),
    render,
    state: { slot: "stat" },
  });
}

export function StatLabel({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-label flex min-w-0 items-center gap-1.5", className)}
      data-slot="stat-label"
      {...props}
    />
  );
}

export function StatIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 [&>svg]:size-3.5", className)}
      data-slot="stat-icon"
      {...props}
    />
  );
}

export function StatValue({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-readout text-2xl leading-tight", className)}
      data-slot="stat-value"
      {...props}
    />
  );
}

export function StatDetail({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground text-[0.71875rem] leading-snug", className)}
      data-slot="stat-detail"
      {...props}
    />
  );
}
