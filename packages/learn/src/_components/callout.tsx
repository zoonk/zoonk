import { cn } from "@zoonk/ui/lib/utils";

export function Callout({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-muted-foreground [&>svg]:text-muted-foreground text-compact flex items-start gap-3 leading-5 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
        className,
      )}
      data-slot="callout"
      {...props}
    />
  );
}
