"use client";

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
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

/**
 * A sheet docked at the bottom on a phone, where it also closes with a swipe down. From `sm` it is
 * a centered dialog, like `Dialog`: a pointer has no use for a grab handle, and a docked box puts
 * a short form far from where the learner was looking. Base UI needs the Viewport wrapper for
 * swipe gestures.
 */
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
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
        data-slot="drawer-viewport"
      >
        <DrawerPrimitive.Popup
          className={cn(
            "bg-background flex max-h-[80dvh] w-full flex-col rounded-t-2xl border-t sm:max-w-lg sm:rounded-2xl sm:border",
            "transform-[translateY(var(--drawer-swipe-movement-y))]",
            "transition-transform duration-450 ease-[cubic-bezier(0.32,0.72,0,1)]",
            "data-swiping:duration-0 data-swiping:select-none",
            "data-ending-style:transform-[translateY(calc(100%+2px))]",
            "data-starting-style:transform-[translateY(calc(100%+2px))]",
            "data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]",
            "sm:transition-[opacity,scale] sm:duration-100 sm:data-ending-style:duration-100",
            "sm:data-ending-style:transform-none sm:data-starting-style:transform-none",
            "sm:data-ending-style:scale-95 sm:data-ending-style:opacity-0",
            "sm:data-starting-style:scale-95 sm:data-starting-style:opacity-0",
            className,
          )}
          data-slot="drawer-popup"
          {...props}
        >
          <div
            className="bg-foreground/50 mx-auto mt-3 h-1 w-10 shrink-0 rounded-full sm:hidden"
            data-slot="drawer-handle"
          />
          <PopupShortcutLayer value>{children}</PopupShortcutLayer>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  );
}

function DrawerContent({ className, ...props }: DrawerPrimitive.Content.Props) {
  return (
    <DrawerPrimitive.Content
      className={cn("scroll-hairline-t overflow-y-auto px-6 pb-6", className)}
      data-slot="drawer-content"
      {...props}
    />
  );
}

/** The ✕ of a sheet, the size of a dialog's. */
function DrawerCloseButton({ label }: { label: string }) {
  return (
    <DrawerPrimitive.Close
      data-slot="drawer-close"
      render={
        <Button
          className="-my-1 shrink-0 [--icon-size:--spacing(5)]"
          edge="end"
          size="icon-sm"
          variant="ghost"
        />
      }
    >
      <XIcon aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </DrawerPrimitive.Close>
  );
}

/**
 * A sheet's title (and its one line under it) with the ✕ that closes it, so no sheet depends on a
 * swipe, Esc or a press outside. The ✕ is a dialog's, at its size.
 */
function DrawerHeader({
  children,
  className,
  closeLabel,
  ...props
}: React.ComponentProps<"div"> & { closeLabel: string }) {
  return (
    <div
      className={cn("flex items-start justify-between gap-3 px-6 pt-4 pb-2", className)}
      data-slot="drawer-header"
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">{children}</div>

      <DrawerCloseButton label={closeLabel} />
    </div>
  );
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      className={cn("text-foreground text-lg leading-tight font-semibold", className)}
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
  DrawerCloseButton,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
};
