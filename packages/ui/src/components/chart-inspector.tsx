"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@zoonk/ui/lib/utils";
import {
  type ComponentProps,
  type ReactNode,
  type RefObject,
  createContext,
  use,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type ChartPointNavigation,
  getChartPointTargetIndex,
} from "./_utils/chart-inspector-keyboard";
import {
  ChartTooltipContent,
  ChartTooltipLabel,
  ChartTooltipNote,
  ChartTooltipValue,
} from "./chart-tooltip";

const POINT_ATTRIBUTE = "data-chart-point";

const TOOLTIP_GAP = 8;

export type ChartPointDetail = { label: string; note?: string; value: string };

type InspectedPoint = { anchor: Element; index: number };

type ChartInspectorContextValue = {
  activeIndex: number;
  anchor: Element | null;
  close: () => void;
  details: readonly ChartPointDetail[];
  groupRef: RefObject<HTMLDivElement | null>;
  inspect: (point: InspectedPoint) => void;
  liveRegionId: string;
  open: boolean;
};

const ChartInspectorContext = createContext<ChartInspectorContextValue | null>(null);

function useChartInspector(): ChartInspectorContextValue {
  const context = use(ChartInspectorContext);

  if (!context) {
    throw new Error("Chart inspector parts must be used inside ChartInspector");
  }

  return context;
}

function getEventPoint(target: EventTarget | null): InspectedPoint | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const anchor = target.closest(`[${POINT_ATTRIBUTE}]`);
  const index = Number(anchor?.getAttribute(POINT_ATTRIBUTE));

  return anchor && Number.isInteger(index) ? { anchor, index } : null;
}

function isSamePoint(current: InspectedPoint | null, next: InspectedPoint): boolean {
  return current?.index === next.index && current.anchor === next.anchor;
}

/**
 * One tooltip for a chart's points: hovering, tapping or moving to a point with the arrow keys
 * shows that point's detail beside it. `details` are in the points' index order.
 */
export function ChartInspector({
  children,
  defaultIndex = 0,
  details,
}: {
  children: ReactNode;
  defaultIndex?: number;
  details: readonly ChartPointDetail[];
}) {
  const liveRegionId = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState<InspectedPoint | null>(null);
  const [open, setOpen] = useState(false);

  const value = useMemo<ChartInspectorContextValue>(
    () => ({
      activeIndex: point?.index ?? defaultIndex,
      anchor: point?.anchor ?? null,
      close: () => setOpen(false),
      details,
      groupRef,
      inspect: (next) => {
        setPoint((current) => (isSamePoint(current, next) ? current : next));
        setOpen(true);
      },
      liveRegionId,
      open,
    }),
    [defaultIndex, details, liveRegionId, open, point],
  );

  return <ChartInspectorContext value={value}>{children}</ChartInspectorContext>;
}

/** Name it with `aria-label` or `aria-labelledby`. */
export function ChartInspectorPoints({
  className,
  getTargetIndex = getChartPointTargetIndex,
  ...props
}: ComponentProps<"div"> & {
  getTargetIndex?: (navigation: ChartPointNavigation) => number | null;
}) {
  const { activeIndex, close, details, groupRef, inspect, liveRegionId } = useChartInspector();

  const inspectIndex = (group: Element, index: number) => {
    const anchor = group.querySelector(`[${POINT_ATTRIBUTE}="${index}"]`);

    if (anchor) {
      anchor.scrollIntoView({ block: "nearest", inline: "nearest" });
      inspect({ anchor, index });
    }
  };

  const inspectTarget = (target: EventTarget | null) => {
    const point = getEventPoint(target);

    if (point) {
      inspect(point);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = getTargetIndex({
      currentIndex: activeIndex,
      key: event.key,
      totalPoints: details.length,
    });

    if (index === null) {
      return;
    }

    event.preventDefault();
    inspectIndex(event.currentTarget, index);
  };

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- The group is one control: arrows and the pointer pick a point for the tooltip.
    <div
      aria-describedby={liveRegionId}
      className={cn(
        "focus-visible:ring-ring/50 cursor-pointer rounded-sm outline-none focus-visible:ring-[3px]",
        className,
      )}
      data-slot="chart-inspector-points"
      onBlur={close}
      onClick={(event) => inspectTarget(event.target)}
      onFocus={(event) => {
        if (event.currentTarget.matches(":focus-visible")) {
          inspectIndex(event.currentTarget, activeIndex);
        }
      }}
      onKeyDown={onKeyDown}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") {
          close();
        }
      }}
      // A touch reaches the tooltip through its click, so a swipe that scrolls the chart shows none.
      onPointerMove={(event) => {
        if (event.pointerType !== "touch") {
          inspectTarget(event.target);
        }
      }}
      ref={groupRef}
      role="group"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- One tab stop for the whole chart, instead of a tiny target per point.
      tabIndex={0}
      {...props}
    />
  );
}

/** `data-active` marks the point the tooltip is on, `data-current` the one the arrow keys move from. */
export function ChartInspectorPoint({
  index,
  render,
  ...props
}: useRender.ComponentProps<"span"> & { index: number }) {
  const { activeIndex, open } = useChartInspector();

  return useRender({
    defaultTagName: "span",
    props: {
      [POINT_ATTRIBUTE]: index,
      "data-active": open && index === activeIndex ? "" : undefined,
      "data-current": index === activeIndex ? "" : undefined,
      "data-slot": "chart-inspector-point",
      ...props,
    },
    render,
  });
}

function ChartPointTooltipContent({ detail }: { detail: ChartPointDetail }) {
  return (
    <ChartTooltipContent>
      <ChartTooltipLabel>{detail.label}</ChartTooltipLabel>
      <ChartTooltipValue>{detail.value}</ChartTooltipValue>
      {detail.note && <ChartTooltipNote>{detail.note}</ChartTooltipNote>}
    </ChartTooltipContent>
  );
}

/**
 * Screen readers get the point's detail from the live region, so the popup is hidden from them.
 * `within` is a selector for the ancestor of the points the tooltip stays inside; without one it stays
 * inside the window.
 */
export function ChartInspectorTooltip({ within }: { within?: string }) {
  const { activeIndex, anchor, close, details, groupRef, liveRegionId, open } = useChartInspector();
  const detail = details.at(activeIndex);
  const boundary = within ? anchor?.closest(within) : null;

  return (
    <>
      <p aria-live="polite" className="sr-only" id={liveRegionId}>
        {detail && [detail.label, detail.value, detail.note].filter(Boolean).join(", ")}
      </p>

      <TooltipPrimitive.Root
        disableHoverablePopup
        onOpenChange={(nextOpen, { event, reason }) => {
          const pressedAnotherPoint =
            reason === "outside-press" &&
            event.target instanceof Node &&
            groupRef.current?.contains(event.target);

          if (!(nextOpen || pressedAnotherPoint)) {
            close();
          }
        }}
        open={open && Boolean(detail)}
      >
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Positioner
            anchor={anchor}
            className="isolate z-50 data-anchor-hidden:invisible"
            collisionBoundary={boundary ?? "clipping-ancestors"}
            collisionPadding={boundary ? 0 : TOOLTIP_GAP}
            side="top"
            sideOffset={TOOLTIP_GAP}
          >
            <TooltipPrimitive.Popup aria-hidden="true" data-slot="chart-inspector-tooltip">
              {detail && <ChartPointTooltipContent detail={detail} />}
            </TooltipPrimitive.Popup>
          </TooltipPrimitive.Positioner>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </>
  );
}
