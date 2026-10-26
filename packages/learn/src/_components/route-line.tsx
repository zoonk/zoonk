import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { type ReactNode } from "react";

/*
 * Route's line: the public course family's one drawing of an order (a course's parts down to its
 * chapters, a chapter's lessons), a pale line in the subject's color (`data-subject` above it) down
 * the page's left edge with a station at each stop. The line is pale because a visitor has
 * traveled none of it, so full strength stays on the stations that are the course's own stops
 * (chapters, lessons); ink rings mark the page's own parts and the page itself (this chapter, this
 * lesson), and a square ends it. It draws an order, never decoration: only lists that are a
 * sequence take it. The design system's patterns page shows it (`/design/patterns#route`).
 *
 * ```tsx
 * <Route>
 *   <RouteStop>
 *     <h1 className="relative">
 *       <RouteMark down />
 *       Quantum physics from scratch
 *     </h1>
 *   </RouteStop>
 *
 *   <RouteStop>
 *     <RouteTitle down up>Course outline</RouteTitle>
 *     <RouteZone summary="Overview">…rows, each with <RouteMark station="stop" />…</RouteZone>
 *   </RouteStop>
 *
 *   <RouteStop>
 *     <RouteTitle station="end" up>Start today, at your level</RouteTitle>
 *   </RouteStop>
 * </Route>
 * ```
 *
 * The first stop's mark draws the line down only and the last one's up only, so it starts and
 * ends at a station.
 */

/**
 * The line's place and its surroundings, as variables the pieces read: its center from the
 * route's left edge (`--route-x`, so a station's left edge meets the page's), where the content
 * starts (`--route-inset`), the surface a station is filled with so the line never shows through
 * it (`--route-fill`) and the line's pale color, full strength with more contrast.
 */
export const ROUTE_CLASS =
  "[--route-fill:var(--background)] [--route-inset:1.75rem] [--route-line:color-mix(in_srgb,var(--subject)_35%,transparent)] [--route-x:0.5rem] contrast-more:[--route-line:var(--subject)] sm:[--route-inset:2.75rem] sm:[--route-x:0.625rem]";

/** The route's column: the page's own column, which the stops and zones fill. */
export function Route({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(ROUTE_CLASS, "flex min-w-0 flex-col", className)}
      data-slot="route"
      {...props}
    />
  );
}

/**
 * A stop on the route: its content on the content's edge, beside the line, which its mark draws
 * through it. Stops touch, so the line runs on unbroken; their spacing is their own padding. The
 * long lines its mark draws end at its edges (`overflow-y: clip`, which neither scrolls nor stops
 * anything inside from sticking).
 */
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
  /** Where the route ends. */
  end: "size-4 rounded-[4px] border-[3px] border-foreground",
  /** The page's own part, or the page itself on its course (a course's parts, this chapter). */
  page: "size-4 rounded-full border-[3px] border-foreground sm:size-[1.125rem]",
  /** A stop of the course itself (a chapter, a lesson), at the subject's full, soft strength. */
  stop: "size-3.5 rounded-full border-[2.5px] border-subject",
  /** Several stops folded into one (a level not opened yet). */
  zone: "h-7 w-3.5 rounded-full border-[2.5px] border-subject",
} as const;

export type RouteStation = keyof typeof STATIONS;

/** A station's look, for a line drawn across rather than down (a chapter's stretch of its course). */
export function getRouteStationClass(station: RouteStation): string {
  return STATIONS[station];
}

/**
 * A station on the line, centered on the first line of the text it's placed in (`0.5lh`): put it
 * first inside a `relative` element that starts at the content's edge, such as a stop's title or
 * a row. `up` and `down` draw the line from it to its stop's edges, so a stop's title carries the
 * line through the whole stop; a stop's own rows draw no line, sitting on the one already there.
 * Decorative: the words beside it say what it marks.
 */
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

/**
 * A stop's name: a public page's part as a real title (`text-section`), its station on the line
 * beside it. `up` and `down` carry the line through the stop.
 */
export function RouteTitle({
  children,
  className,
  down = false,
  station = "page",
  up = false,
  ...props
}: React.ComponentProps<"h2"> & { down?: boolean; station?: RouteStation; up?: boolean }) {
  return (
    <h2 className={cn("text-section relative", className)} {...props}>
      <RouteMark down={down} station={station} up={up} />
      {children}
    </h2>
  );
}

/**
 * A band behind part of the route (a level, an exam's area), which the line runs through, folded
 * to one row until opened: a native `<details>`, so its rows are in the page's HTML and it opens
 * before any script loads. It reaches past the line to the screen's edges on a phone and a little
 * past the page's edge from `sm`, its words back on the content's edge and its stations filled
 * with its own surface. Folded, a capsule on the line stands for its stops; open, its rows carry
 * their own (`RouteMark station="stop"`). `aside` says how much it holds.
 */
export function RouteZone({
  aside,
  children,
  open = false,
  summary,
}: {
  aside?: ReactNode;
  children: ReactNode;
  /** Open on arrival, for the one a page expects most visitors to want. */
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
      {/* The aside and the chevron stay on the summary's first line when it wraps. */}
      <summary className="hover:text-foreground focus-visible:ring-ring/50 relative flex cursor-pointer list-none gap-4 rounded-md py-4 text-[0.9375rem] leading-snug font-semibold outline-none select-none focus-visible:ring-[3px] sm:text-base [&::-webkit-details-marker]:hidden">
        <RouteMark className="top-1/2 group-open/zone:hidden" station="zone" />

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
