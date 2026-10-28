import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { type ReactNode } from "react";

export const ROUTE_CLASS =
  "[--route-fill:var(--background)] [--route-inset:1.75rem] [--route-line:color-mix(in_srgb,var(--subject)_35%,transparent)] [--route-x:0.5rem] contrast-more:[--route-line:var(--subject)] sm:[--route-inset:2.75rem] sm:[--route-x:0.625rem]";

export function Route({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(ROUTE_CLASS, "flex min-w-0 flex-col", className)}
      data-slot="route"
      {...props}
    />
  );
}

/** `overflow-y: clip` ends its mark's long lines at its edges without breaking `sticky` inside, as `hidden` would. */
export function RouteStop({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("relative min-w-0 overflow-y-clip pl-(--route-inset)", className)}
      data-slot="route-stop"
      {...props}
    />
  );
}

const STATIONS = {
  end: "size-4 rounded-[4px] border-[3px] border-foreground",
  page: "size-4 rounded-full border-[3px] border-foreground sm:size-[1.125rem]",
  stop: "size-3.5 rounded-full border-[2.5px] border-subject",
} as const;

const ZONE_STATION_CLASS = "w-3.5 rounded-full border-[2.5px] border-subject";

type RouteStation = keyof typeof STATIONS;

export function getRouteStationClass(station: RouteStation): string {
  return STATIONS[station];
}

export function RouteMark({
  className,
  down = false,
  station = "page",
  up = false,
}: {
  className?: string;
  down?: boolean;
  station?: RouteStation;
  up?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-[0.5lh] left-[calc(var(--route-x)-var(--route-inset))] z-1",
        className,
      )}
      data-slot="route-mark"
    >
      {up && (
        <span className="absolute bottom-0 h-[100000px] w-1 -translate-x-1/2 bg-(--route-line)" />
      )}

      {down && (
        <span className="absolute top-0 h-[100000px] w-1 -translate-x-1/2 bg-(--route-line)" />
      )}

      <span
        className={cn(
          "absolute block -translate-x-1/2 -translate-y-1/2 bg-(--route-fill)",
          STATIONS[station],
        )}
      />
    </span>
  );
}

export function RouteTitle({
  children,
  className,
  down = false,
  station = "page",
  ...props
}: React.ComponentProps<"h2"> & { down?: boolean; station?: RouteStation }) {
  return (
    <h2 className={cn("text-section relative", className)} {...props}>
      <RouteMark down={down} station={station} up />
      {children}
    </h2>
  );
}

/** A native `<details>`, so its rows are in the page's HTML and it opens before any script loads. */
export function RouteZone({
  aside,
  children,
  open = false,
  summary,
}: {
  aside?: ReactNode;
  children: ReactNode;
  open?: boolean;
  summary: ReactNode;
}) {
  return (
    <details
      className={cn(
        "group/zone bg-ground relative [--route-fill:var(--ground)]",
        "-mr-4 ml-[calc(-1*var(--route-inset)-1rem)] pr-4 pl-[calc(var(--route-inset)+1rem)]",
        "sm:mr-0 sm:ml-[calc(-1*var(--route-inset)-0.75rem)] sm:rounded-xl sm:pr-5 sm:pl-[calc(var(--route-inset)+0.75rem)]",
      )}
      data-slot="route-zone"
      open={open}
    >
      <summary className="hover:text-foreground focus-visible:ring-ring/50 relative flex cursor-pointer list-none gap-4 rounded-md py-4 text-[0.9375rem] leading-snug font-semibold outline-none select-none focus-visible:ring-[3px] sm:text-base [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-4 left-[calc(var(--route-x)-var(--route-inset))] z-1 -translate-x-1/2 bg-(--route-fill) group-open/zone:hidden",
            ZONE_STATION_CLASS,
          )}
        />

        <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <span className="text-pretty">{summary}</span>

          {aside && (
            <span className="text-muted-foreground flex-none font-mono text-xs font-normal tabular-nums">
              {aside}
            </span>
          )}
        </span>

        <LineMarker>
          <ChevronDownIcon
            aria-hidden="true"
            className="text-muted-foreground size-4 transition-transform group-open/zone:rotate-180 motion-reduce:transition-none"
          />
        </LineMarker>
      </summary>

      <div className="pb-4">{children}</div>
    </details>
  );
}
