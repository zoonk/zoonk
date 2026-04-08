"use client";

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import type * as React from "react";

function Drawer({ ...props }: DrawerPrimitive.Root.Props) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

/**
 * Semi-transparent overlay behind the drawer.
 *
 * Opacity is tied to `--drawer-swipe-progress` so it fades
 * as the user swipes to dismiss. Transitions are disabled
 * during active swiping (`data-[swiping]:duration-0`) so the
 * backdrop tracks the finger exactly.
 */
function DrawerBackdrop({ className, ...props }: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-black",
        "[--backdrop-opacity:0.5] dark:[--backdrop-opacity:0.7]",
        "opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))]",
        "transition-opacity duration-450 ease-[cubic-bezier(0.32,0.72,0,1)]",
        "data-swiping:duration-0",
        "data-ending-style:opacity-0 data-starting-style:opacity-0",
        "data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]",
        className,
      )}
      data-slot="drawer-backdrop"
      {...props}
    />
  );
}

/**
 * The main drawer panel. Renders as a bottom sheet by default
 * with swipe-to-dismiss support via base-ui's Drawer primitive.
 *
 * The Viewport wrapper is required for swipe gestures to work.
 * The Popup tracks the swipe via `translateY(var(--drawer-swipe-movement-y))`
 * and uses velocity-based exit duration via `--drawer-swipe-strength`.
 */
function DrawerPopup({ className, children, ...props }: DrawerPrimitive.Popup.Props) {
  return (
    <DrawerPortal>
      <DrawerBackdrop />
      <DrawerPrimitive.Viewport
        className="fixed inset-0 z-50 flex items-end justify-center"
        data-slot="drawer-viewport"
      >
        <DrawerPrimitive.Popup
          className={cn(
            "bg-background flex max-h-[80dvh] w-full flex-col rounded-t-xl border-t sm:mb-4 sm:max-w-2xl sm:rounded-xl sm:border",
            "transform-[translateY(var(--drawer-swipe-movement-y))]",
            "transition-transform duration-450 ease-[cubic-bezier(0.32,0.72,0,1)]",
            "data-swiping:duration-0 data-swiping:select-none",
            "data-ending-style:transform-[translateY(calc(100%+2px))]",
            "data-starting-style:transform-[translateY(calc(100%+2px))]",
            "data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]",
            className,
          )}
          data-slot="drawer-popup"
          {...props}
        >
          <div className="bg-muted mx-auto mt-3 h-1 w-10 shrink-0 rounded-full" />
          {children}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  );
}

/**
 * Wraps text content inside the drawer to allow text selection
 * without triggering swipe-to-dismiss gestures.
 */
function DrawerContent({ className, ...props }: DrawerPrimitive.Content.Props) {
  return (
    <DrawerPrimitive.Content
      className={cn("overflow-y-auto px-6 pb-6", className)}
      data-slot="drawer-content"
      {...props}
    />
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 px-6 pt-4 pb-2", className)}
      data-slot="drawer-header"
      {...props}
    />
  );
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      className={cn("text-foreground text-base font-medium", className)}
      data-slot="drawer-title"
      {...props}
    />
  );
}

function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="drawer-description"
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
