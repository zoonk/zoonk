"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@zoonk/ui/lib/utils";
import type * as React from "react";

/** A popover keeps the page's gutter from the screen's edge, as content does (craft S5). */
const PAGE_GUTTER = 16;

/**
 * The screen's main action is pinned over the page, so its bar is the screen's bottom edge too:
 * a popover keeps the gutter above it, and turns upward when there's no room under its trigger.
 * Read as the popover opens, since the bar shows or hides with the page.
 */
function getEdgePadding() {
  const bars = [...document.querySelectorAll('[data-slot="bottom-bar"]')]
    .map((bar) => bar.getBoundingClientRect())
    .filter((rect) => rect.height > 0);

  const barTop = Math.min(window.innerHeight, ...bars.map((rect) => rect.top));

  return {
    bottom: Math.max(0, window.innerHeight - barTop) + PAGE_GUTTER,
    left: PAGE_GUTTER,
    right: PAGE_GUTTER,
    top: PAGE_GUTTER,
  };
}

/** Rendered only while the popover is open, so it measures the bar the open popover has to clear. */
function PopoverPositioner(props: PopoverPrimitive.Positioner.Props) {
  return <PopoverPrimitive.Positioner collisionPadding={getEdgePadding()} {...props} />;
}

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "center",
  alignOffset = 0,
  anchor,
  backdrop = true,
  collisionAvoidance,
  side = "bottom",
  sideOffset = 4,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "anchor" | "collisionAvoidance" | "side" | "sideOffset"
  > & {
    /** The backdrop takes the click that closes the popover; without it, the click also lands. */
    backdrop?: boolean;
  }) {
  return (
    <PopoverPrimitive.Portal>
      {backdrop ? <PopoverPrimitive.Backdrop className="fixed inset-0" /> : null}
      <PopoverPositioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="isolate z-50"
        collisionAvoidance={collisionAvoidance}
        side={side}
        sideOffset={sideOffset}
      >
        <PopoverPrimitive.Popup
          className={cn(
            "data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 bg-popover text-popover-foreground ring-foreground/10 data-closed:animate-out data-open:animate-in z-50 flex w-72 origin-(--transform-origin) flex-col gap-4 rounded-xl p-4 text-sm shadow-2xl ring-1 outline-hidden duration-100 ring-inset",
            className,
          )}
          data-slot="popover-content"
          {...props}
        />
      </PopoverPositioner>
    </PopoverPrimitive.Portal>
  );
}

/**
 * Points from the popover at what it's about: a corner of the popover's own fill, edged like the
 * popover, that covers the popover's edge where they meet.
 */
function PopoverArrow({ className, ...props }: PopoverPrimitive.Arrow.Props) {
  return (
    <PopoverPrimitive.Arrow
      className={cn(
        "bg-popover border-foreground/10 size-3 rotate-45 rounded-[2px] data-[side=bottom]:-top-1.5 data-[side=bottom]:border-t data-[side=bottom]:border-l data-[side=left]:-right-1.5 data-[side=left]:border-t data-[side=left]:border-r data-[side=right]:-left-1.5 data-[side=right]:border-b data-[side=right]:border-l data-[side=top]:-bottom-1.5 data-[side=top]:border-r data-[side=top]:border-b",
        className,
      )}
      data-slot="popover-arrow"
      {...props}
    />
  );
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1 text-sm", className)}
      data-slot="popover-header"
      {...props}
    />
  );
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      className={cn("text-sm font-medium", className)}
      data-slot="popover-title"
      {...props}
    />
  );
}

function PopoverDescription({ className, ...props }: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      className={cn("text-muted-foreground", className)}
      data-slot="popover-description"
      {...props}
    />
  );
}

export {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
