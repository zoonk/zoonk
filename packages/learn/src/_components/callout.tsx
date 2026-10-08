import { cn } from "@zoonk/ui/lib/utils";

/**
 * A rule or a note the learner should notice before acting ("The result only appears at the end"),
 * on a soft panel with its icon, so it reads as one thing instead of another gray line.
 */
export function Callout({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-muted/60 text-foreground [&>svg]:text-muted-foreground flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm leading-5 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
        className,
      )}
      data-slot="callout"
      {...props}
    />
  );
}
