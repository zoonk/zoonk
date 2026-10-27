"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * ScrollAreaRoot is exposed separately so composed primitives like Autocomplete
 * can render their own content element inside Base UI's scroll viewport.
 */
function ScrollAreaRoot({ className, ...props }: ScrollAreaPrimitive.Root.Props) {
  return (
    <ScrollAreaPrimitive.Root
      className={cn("relative", className)}
      data-slot="scroll-area"
      {...props}
    />
  );
}

/**
 * ScrollAreaViewport owns the native scroll container while keeping focus
 * styles consistent with the rest of the UI package.
 */
function ScrollAreaViewport({ className, ...props }: ScrollAreaPrimitive.Viewport.Props) {
  return (
    <ScrollAreaPrimitive.Viewport
      className={cn(
        "focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1",
        className,
      )}
      data-slot="scroll-area-viewport"
      {...props}
    />
  );
}

/**
 * ScrollAreaContent lets list primitives render as the measured scroll content
 * element that Base UI expects for stable scrolling and thumb sizing.
 */
function ScrollAreaContent({ className, ...props }: ScrollAreaPrimitive.Content.Props) {
  return (
    <ScrollAreaPrimitive.Content
      className={cn("min-w-full", className)}
      data-slot="scroll-area-content"
      {...props}
    />
  );
}

/** The scrollbar's thumb, inside `ScrollAreaScrollbar`. */
function ScrollAreaThumb({ className, ...props }: ScrollAreaPrimitive.Thumb.Props) {
  return (
    <ScrollAreaPrimitive.Thumb
      className={cn("bg-border relative flex-1 rounded-full", className)}
      data-slot="scroll-area-thumb"
      {...props}
    />
  );
}

/**
 * ScrollAreaScrollbar wraps the native scrollbar primitive while preserving the
 * shared orientation-aware sizing and touch behavior.
 */
function ScrollAreaScrollbar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      className={cn(
        "flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent",
        className,
      )}
      data-orientation={orientation}
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      {...props}
    />
  );
}

export {
  ScrollAreaContent,
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
};
