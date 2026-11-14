"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useHideElement } from "@zoonk/ui/hooks/hide-element";
import { OVERLAY_DIM_CLASS } from "@zoonk/ui/lib/overlay-dim";
import { cn } from "@zoonk/ui/lib/utils";
import { createContext, useContext } from "react";
import { PopupShortcutLayer } from "../hooks/_utils/popup-shortcut-layer";
import { MenuOpenerNotice, useFocusAfterMenuItem } from "./_utils/menu-handoff";

/** Lets the portal stay hidden after Next.js's Activity cleanup until a real reopen: https://github.com/vercel/next.js/issues/86577 */
const DialogOpenContext = createContext<boolean | undefined>(undefined);

function Dialog({ open, ...props }: DialogPrimitive.Root.Props) {
  return (
    <DialogOpenContext.Provider value={open}>
      <DialogPrimitive.Root data-slot="dialog" open={open} {...props} />
    </DialogOpenContext.Provider>
  );
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  const open = useContext(DialogOpenContext);
  const ref = useHideElement<HTMLDivElement>(open);
  return <DialogPrimitive.Portal data-slot="dialog-portal" ref={ref} {...props} />;
}

function DialogViewport({ className, ...props }: DialogPrimitive.Viewport.Props) {
  return (
    <DialogPrimitive.Viewport
      className={cn("fixed inset-0 z-50", className)}
      data-slot="dialog-viewport"
      {...props}
    />
  );
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

/** Drawn for a nested overlay too, which Base UI skips, so whatever it opened from dims under it. */
function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      forceRender
      className={cn(
        "data-closed:fade-out-0 data-open:fade-in-0 data-closed:animate-out data-open:animate-in fixed inset-0 isolate z-50 duration-100",
        OVERLAY_DIM_CLASS,
        className,
      )}
      data-slot="dialog-overlay"
      {...props}
    />
  );
}

function DialogPopup({ children, className, finalFocus, ...props }: DialogPrimitive.Popup.Props) {
  const handoff = useFocusAfterMenuItem(finalFocus);

  return (
    <DialogPrimitive.Popup
      className={cn("bg-background text-foreground outline-none", className)}
      data-slot="dialog-content"
      {...props}
      finalFocus={handoff.finalFocus}
    >
      <MenuOpenerNotice onOpen={handoff.onOpen} />
      <PopupShortcutLayer value>{children}</PopupShortcutLayer>
    </DialogPrimitive.Popup>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn("text-lg leading-tight font-semibold", className)}
      data-slot="dialog-title"
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      className={cn(
        "text-muted-foreground *:[a]:hover:text-foreground text-sm *:[a]:underline *:[a]:underline-offset-3",
        className,
      )}
      data-slot="dialog-description"
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
};
