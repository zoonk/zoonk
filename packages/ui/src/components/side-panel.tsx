"use client";

import { Dialog as SidePanelPrimitive } from "@base-ui/react/dialog";
import { OVERLAY_DIM_CLASS } from "@zoonk/ui/lib/overlay-dim";
import { cn } from "@zoonk/ui/lib/utils";
import { PopupShortcutLayer } from "../hooks/_utils/popup-shortcut-layer";
import { MenuOpenerNotice, useFocusAfterMenuItem } from "./_utils/menu-handoff";
import { PanelCloseButton } from "./_utils/panel-close";
import type * as React from "react";

/**
 * A panel docked to a side of the window, for what is edited beside the thing it changes and for
 * a menu. What opens over a page to answer or read one thing is a `Drawer`.
 */
function SidePanel({ ...props }: SidePanelPrimitive.Root.Props) {
  return <SidePanelPrimitive.Root data-slot="side-panel" {...props} />;
}

function SidePanelPortal({ ...props }: SidePanelPrimitive.Portal.Props) {
  return <SidePanelPrimitive.Portal data-slot="side-panel-portal" {...props} />;
}

/** Drawn for a nested overlay too, which Base UI skips, so whatever it opened from dims under it. */
function SidePanelOverlay({ className, ...props }: SidePanelPrimitive.Backdrop.Props) {
  return (
    <SidePanelPrimitive.Backdrop
      forceRender
      className={cn(
        "data-closed:fade-out-0 data-open:fade-in-0 data-closed:animate-out data-open:animate-in fixed inset-0 z-50 duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0",
        OVERLAY_DIM_CLASS,
        className,
      )}
      data-slot="side-panel-overlay"
      {...props}
    />
  );
}

function SidePanelContent({
  className,
  children,
  side = "right",
  finalFocus,
  ...props
}: SidePanelPrimitive.Popup.Props & { side?: "left" | "right" }) {
  const handoff = useFocusAfterMenuItem(finalFocus);

  return (
    <SidePanelPortal>
      <SidePanelOverlay />
      <SidePanelPrimitive.Popup
        className={cn(
          "data-[side=right]:data-closed:slide-out-to-right-10 data-[side=right]:data-open:slide-in-from-right-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=left]:data-open:slide-in-from-left-10 data-closed:fade-out-0 data-open:fade-in-0 bg-background data-closed:animate-out data-open:animate-in fixed inset-y-0 z-50 flex h-full w-3/4 flex-col bg-clip-padding text-sm shadow-lg transition duration-200 ease-in-out data-[side=left]:left-0 data-[side=left]:border-r data-[side=right]:right-0 data-[side=right]:border-l sm:max-w-sm",
          className,
        )}
        data-side={side}
        data-slot="side-panel-content"
        {...props}
        finalFocus={handoff.finalFocus}
      >
        <MenuOpenerNotice onOpen={handoff.onOpen} />
        <PopupShortcutLayer value>{children}</PopupShortcutLayer>
      </SidePanelPrimitive.Popup>
    </SidePanelPortal>
  );
}

/** A side panel's title with the ✕ that closes it, like a sheet's. */
function SidePanelHeader({
  children,
  className,
  closeLabel,
  ...props
}: React.ComponentProps<"div"> & { closeLabel: string }) {
  return (
    <div
      className={cn("flex items-start justify-between gap-3 px-6 pt-6 pb-3", className)}
      data-slot="side-panel-header"
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">{children}</div>

      <SidePanelPrimitive.Close
        data-slot="side-panel-close"
        render={<PanelCloseButton label={closeLabel} />}
      />
    </div>
  );
}

function SidePanelTitle({ className, ...props }: SidePanelPrimitive.Title.Props) {
  return (
    <SidePanelPrimitive.Title
      className={cn("text-foreground text-lg leading-tight font-semibold", className)}
      data-slot="side-panel-title"
      {...props}
    />
  );
}

export { SidePanel, SidePanelContent, SidePanelHeader, SidePanelTitle };
