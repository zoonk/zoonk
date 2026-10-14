import { cn } from "@zoonk/ui/lib/utils";

/**
 * A rule or a note the learner should notice before acting ("The result only appears at the end"):
 * one quiet 13px line with its muted icon, straight on the page, never a filled box.
 */
export function Callout({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-muted-foreground [&>svg]:text-muted-foreground flex items-start gap-2 text-[0.8125rem] leading-5 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
        className,
      )}
      data-slot="callout"
      {...props}
    />
  );
}
