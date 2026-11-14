"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { Button } from "@zoonk/ui/components/button";
import { OVERLAY_ACTIONS_CLASS } from "@zoonk/ui/lib/overlay-actions";
import { OVERLAY_DIM_CLASS } from "@zoonk/ui/lib/overlay-dim";
import { cn } from "@zoonk/ui/lib/utils";
import { PopupShortcutLayer } from "../hooks/_utils/popup-shortcut-layer";
import { MenuOpenerNotice, useFocusAfterMenuItem } from "./_utils/menu-handoff";
import type * as React from "react";

function AlertDialog({ ...props }: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger({ ...props }: AlertDialogPrimitive.Trigger.Props) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />;
}

/** Drawn for a nested overlay too, which Base UI skips, so whatever it opened from dims under it. */
function AlertDialogOverlay({ className, ...props }: AlertDialogPrimitive.Backdrop.Props) {
  return (
    <AlertDialogPrimitive.Backdrop
      forceRender
      className={cn(
        "data-closed:fade-out-0 data-open:fade-in-0 data-closed:animate-out data-open:animate-in fixed inset-0 isolate z-50 duration-100",
        OVERLAY_DIM_CLASS,
        className,
      )}
      data-slot="alert-dialog-overlay"
      {...props}
    />
  );
}

/**
 * A question that needs an answer before anything else: it doesn't close on a press outside. On a
 * phone it rises from the bottom like every sheet, with the answers stacked under the thumb and no
 * grab handle, since it doesn't leave by a swipe. From `sm` it is centered, like `Drawer`.
 */
function AlertDialogContent({
  children,
  className,
  finalFocus,
  ...props
}: AlertDialogPrimitive.Popup.Props) {
  const handoff = useFocusAfterMenuItem(finalFocus);

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        className={cn(
          "bg-background data-closed:animate-out data-open:animate-in fixed z-50 grid w-full gap-6 p-6 outline-none",
          "max-sm:data-closed:slide-out-to-bottom max-sm:data-open:slide-in-from-bottom max-sm:inset-x-0 max-sm:bottom-0 max-sm:rounded-t-2xl max-sm:border-t max-sm:duration-300",
          "sm:data-closed:fade-out-0 sm:data-open:fade-in-0 sm:data-closed:zoom-out-95 sm:data-open:zoom-in-95 sm:ring-foreground/10 sm:top-1/2 sm:left-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:ring-1 sm:duration-100 sm:ring-inset",
          className,
        )}
        data-slot="alert-dialog-content"
        {...props}
        finalFocus={handoff.finalFocus}
      >
        <MenuOpenerNotice onOpen={handoff.onOpen} />
        <PopupShortcutLayer value>{children}</PopupShortcutLayer>
      </AlertDialogPrimitive.Popup>
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1.5", className)}
      data-slot="alert-dialog-header"
      {...props}
    />
  );
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(OVERLAY_ACTIONS_CLASS, className)}
      data-slot="alert-dialog-footer"
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      className={cn("text-lg leading-tight font-semibold", className)}
      data-slot="alert-dialog-title"
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn(
        "text-muted-foreground *:[a]:hover:text-foreground text-sm text-balance *:[a]:underline *:[a]:underline-offset-3",
        className,
      )}
      data-slot="alert-dialog-description"
      {...props}
    />
  );
}

function AlertDialogAction({ size = "lg", ...props }: React.ComponentProps<typeof Button>) {
  return <Button data-slot="alert-dialog-action" size={size} {...props} />;
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "lg",
  ...props
}: AlertDialogPrimitive.Close.Props &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <AlertDialogPrimitive.Close
      className={cn(className)}
      data-slot="alert-dialog-cancel"
      render={<Button size={size} variant={variant} />}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
};
