import { SURFACE_CLASS } from "@zoonk/learn/surface";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * The app on a public page: its surface (the card's fill, a hairline, no shadow) around the app's
 * own pieces at their real size, so a visitor sees the product rather than a picture of it.
 */
export function ProductWindow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(SURFACE_CLASS, "min-w-0 overflow-hidden", className)}
      data-slot="product-window"
      {...props}
    />
  );
}
