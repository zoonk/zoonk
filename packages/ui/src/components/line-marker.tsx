import { cn } from "@zoonk/ui/lib/utils";

/**
 * One line of the surrounding text tall (`h-lh`): put it in an `items-start` row and size the text,
 * never the marker. Outside that text's element, give it the text's size.
 */
export function LineMarker({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("flex h-lh flex-none items-center", className)}
      data-slot="line-marker"
      {...props}
    />
  );
}
