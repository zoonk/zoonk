import { cn } from "@zoonk/ui/lib/utils";
import { PUBLIC_BAND_CLASS, PUBLIC_CONTAINER_CLASS } from "./landing-styles";

const RAIL_LINE_CLASS = cn(
  "min-[88rem]:before:bg-border min-[88rem]:before:absolute min-[88rem]:before:inset-y-0 min-[88rem]:before:left-[calc((100%-84rem)/2-0.75rem)] min-[88rem]:before:w-px",
  "min-[88rem]:first:before:top-[calc(var(--spacing)*24+0.5rem)]",
  "min-[88rem]:last:before:bottom-auto min-[88rem]:last:before:h-[calc(var(--spacing)*24+0.5rem)]",
);

export function Stop({
  band = false,
  children,
  className,
  rail = false,
  ...props
}: React.ComponentProps<"section"> & { band?: boolean; rail?: boolean }) {
  return (
    <section
      className={cn(
        "group/stop relative [--stop-surface:var(--background)]",
        band && "bg-ground [--stop-surface:var(--ground)]",
        rail && RAIL_LINE_CLASS,
      )}
      data-rail={rail || undefined}
      data-slot="stop"
      {...props}
    >
      <div
        className={cn(
          PUBLIC_CONTAINER_CLASS,
          PUBLIC_BAND_CLASS,
          "flex min-w-0 flex-col",
          className,
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function StopHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-3", className)} data-slot="stop-header" {...props} />
  );
}

export function StopTitle({ children, className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2 className={cn("text-section", className)} data-slot="stop-title" {...props}>
      {children}
    </h2>
  );
}

export function StopBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("mt-9 min-w-0 lg:mt-11", className)} data-slot="stop-body" {...props} />
  );
}
