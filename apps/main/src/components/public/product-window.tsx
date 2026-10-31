import { SURFACE_CLASS } from "@zoonk/learn/surface";
import { cn } from "@zoonk/ui/lib/utils";

export function ProductWindow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(SURFACE_CLASS, "min-w-0 overflow-hidden", className)}
      data-slot="product-window"
      {...props}
    />
  );
}
