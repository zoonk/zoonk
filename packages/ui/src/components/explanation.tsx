import { cn } from "@zoonk/ui/lib/utils";

function Explanation({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section className={cn("flex flex-col gap-2", className)} data-slot="explanation" {...props} />
  );
}

function ExplanationHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="explanation-header"
      {...props}
    />
  );
}

function ExplanationTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    // oxlint-disable-next-line jsx-a11y/heading-has-content -- content via children
    <h3 className={cn("text-sm font-medium", className)} data-slot="explanation-title" {...props} />
  );
}

function ExplanationText({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="explanation-text"
      {...props}
    />
  );
}

export { Explanation, ExplanationHeader, ExplanationTitle, ExplanationText };
