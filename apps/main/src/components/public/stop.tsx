import { cn } from "@zoonk/ui/lib/utils";
import {
  EYEBROW_CLASS,
  LEAD_CLASS,
  PUBLIC_BAND_CLASS,
  PUBLIC_CONTAINER_CLASS,
  STOP_TITLE_CLASS,
} from "./landing-styles";

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
    <div className={cn("flex flex-col gap-4", className)} data-slot="stop-header" {...props} />
  );
}

export function StopEyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("relative flex items-center gap-2.5", EYEBROW_CLASS, className)}
      data-slot="stop-eyebrow"
      {...props}
    />
  );
}

/** Decorative: the eyebrow says it. */
export function StopMark({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "text-foreground flex size-4 shrink-0 items-center justify-center",
        "min-[88rem]:group-data-rail/stop:absolute min-[88rem]:group-data-rail/stop:-left-13 min-[88rem]:group-data-rail/stop:rounded-full min-[88rem]:group-data-rail/stop:bg-(--stop-surface) min-[88rem]:group-data-rail/stop:ring-6 min-[88rem]:group-data-rail/stop:ring-(--stop-surface)",
        className,
      )}
      data-slot="stop-mark"
      {...props}
    />
  );
}

export function StopTitle({ children, className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2 className={cn(STOP_TITLE_CLASS, className)} data-slot="stop-title" {...props}>
      {children}
    </h2>
  );
}

export function StopLead({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn(LEAD_CLASS, "-mt-1", className)} data-slot="stop-lead" {...props} />;
}

export function StopBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("mt-9 min-w-0 lg:mt-11", className)} data-slot="stop-body" {...props} />
  );
}
