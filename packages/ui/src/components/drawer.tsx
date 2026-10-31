"use client";

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import { PopupShortcutLayer } from "../hooks/_utils/popup-shortcut-layer";
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

/** Base UI needs the Viewport wrapper for swipe gestures. */
function DrawerPopup({
  backdropClassName,
  className,
  children,
  ...props
}: DrawerPrimitive.Popup.Props & { backdropClassName?: string }) {
  return (
    <DrawerPortal>
      <DrawerBackdrop className={backdropClassName} />
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
          <PopupShortcutLayer value>{children}</PopupShortcutLayer>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  );
}

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
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
};
