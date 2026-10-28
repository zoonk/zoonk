import { cn } from "@zoonk/ui/lib/utils";

export const SURFACE_CLASS = "bg-card text-card-foreground ring-border rounded-xl ring-1";

export function Surface({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn(SURFACE_CLASS, className)} data-slot="surface" {...props} />;
}
