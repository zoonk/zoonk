"use client";

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { OVERLAY_DIM_CLASS } from "@zoonk/ui/lib/overlay-dim";
import { cn } from "@zoonk/ui/lib/utils";
import { PopupShortcutLayer } from "../hooks/_utils/popup-shortcut-layer";
import { PanelCloseButton } from "./_utils/panel-close";
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

/** Drawn for a nested overlay too, which Base UI skips, so whatever it opened from dims under it. */
function DrawerBackdrop({ className, ...props }: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      forceRender
      className={cn(
        "fixed inset-0 z-50 opacity-[calc(1-var(--drawer-swipe-progress))]",
        OVERLAY_DIM_CLASS,
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
 * swipe gestures, and its keyboard provider keeps a focused field above a phone's keyboard.
 */
function DrawerPopup({ className, children, ...props }: DrawerPrimitive.Popup.Props) {
  return (
    <DrawerPrimitive.VirtualKeyboardProvider>
      <DrawerPortal>
        <DrawerBackdrop />
        <DrawerPrimitive.Viewport
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          data-slot="drawer-viewport"
        >
          <DrawerPrimitive.Popup
            className={cn(
              "bg-background flex max-h-[80dvh] w-full flex-col rounded-t-2xl border-t outline-none sm:max-w-lg sm:rounded-2xl sm:border",
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
    </DrawerPrimitive.VirtualKeyboardProvider>
  );
}

function DrawerContent({ className, ...props }: DrawerPrimitive.Content.Props) {
  return (
    <DrawerPrimitive.Content
      className={cn(
        "scroll-hairline-t overflow-y-auto px-6 pb-6",
        "[&:has(+[data-slot=drawer-footer])]:scroll-hairline-y [&:has(+[data-slot=drawer-footer])]:pb-2",
        className,
      )}
      data-slot="drawer-content"
      {...props}
    />
  );
}

/** A sheet's ✕, for the one sheet that draws no header. */
function DrawerCloseButton({ label }: { label: string }) {
  return (
    <DrawerPrimitive.Close data-slot="drawer-close" render={<PanelCloseButton label={label} />} />
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
      className={cn("flex items-start justify-between gap-3 px-6 pt-4 pb-2 sm:pt-6", className)}
      data-slot="drawer-header"
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">{children}</div>

      <DrawerCloseButton label={closeLabel} />
    </div>
  );
}

/**
 * A sheet's foot, held under its content while that scrolls: one line that says what the actions
 * will do (`note`), then the actions. On a phone they stack full width with the last one (the main
 * action) on top; from `sm` they sit in a row at the end, in order. Its edge is the content's, drawn
 * only while something scrolls under it.
 */
function DrawerFooter({
  children,
  className,
  note,
  ...props
}: React.ComponentProps<"div"> & { note?: React.ReactNode }) {
  return (
    <div
      className={cn("flex shrink-0 flex-col gap-3 px-6 pt-4 pb-6", className)}
      data-slot="drawer-footer"
      {...props}
    >
      {note}
      {children && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>
      )}
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
  DrawerFooter,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
};
