import { cn } from "@zoonk/ui/lib/utils";

/** Groups one pattern dimension through spacing instead of a bordered card. */
export function PatternSection({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("flex flex-col gap-5", className)}
      data-slot="pattern-section"
      {...props}
    />
  );
}

/** Keeps a pattern heading and its fixed-window context together. */
export function PatternSectionHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1", className)}
      data-slot="pattern-section-header"
      {...props}
    />
  );
}

/** Names one learner-performance dimension such as the week or the day. */
export function PatternSectionTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    // oxlint-disable-next-line jsx-a11y/heading-has-content -- content provided through props
    <h2
      className={cn("font-semibold tracking-tight", className)}
      data-slot="pattern-section-title"
      {...props}
    />
  );
}

/** Explains the shared 90-day window without repeating it for every value. */
export function PatternSectionDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="pattern-section-description"
      {...props}
    />
  );
}
