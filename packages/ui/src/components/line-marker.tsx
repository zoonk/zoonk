import { cn } from "@zoonk/ui/lib/utils";

/**
 * Holds an icon, number, check or other marker centered on the first line of the text beside it,
 * however many lines that text wraps to. Its height is one line of the surrounding text (`h-lh`),
 * so put it in an `items-start` row and size the text, never the marker. Give it the text's size
 * (`text-sm`, …) when it sits outside that text's element.
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
