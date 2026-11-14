"use client";

import { type Dialog } from "@base-ui/react/dialog";
import { useLayoutEffect, useState } from "react";

type FinalFocus = Dialog.Popup.Props["finalFocus"];

/** Base UI labels a menu's popup by its trigger. */
function getMenuTrigger(element: Element | null): HTMLElement | null {
  const triggerId = element?.closest("[role=menu]")?.getAttribute("aria-labelledby");
  return triggerId ? document.querySelector<HTMLElement>(`#${CSS.escape(triggerId)}`) : null;
}

function isOutsideMenus(element: Element | null): boolean {
  return Boolean(element && element !== document.body && !element.closest("[role=menu]"));
}

/**
 * A menu's own `finalFocus` gives way when focus has already left the menu for something else,
 * such as a sheet one of its items opened. Base UI does that only for its default.
 */
export function yieldMenuFocus(finalFocus: FinalFocus): FinalFocus {
  if (finalFocus === undefined || typeof finalFocus === "boolean") {
    return finalFocus;
  }

  return (closeType) => {
    if (isOutsideMenus(document.activeElement)) {
      return false;
    }

    return typeof finalFocus === "function" ? finalFocus(closeType) : finalFocus.current;
  };
}

/**
 * An overlay opened from a menu item gives focus back to the menu's trigger when it closes: by
 * then the item has gone with its menu. Render `MenuOpenerNotice` inside the overlay's popup.
 */
export function useFocusAfterMenuItem(finalFocus: FinalFocus) {
  const [menuTrigger, setMenuTrigger] = useState<HTMLElement | null>(null);

  return {
    finalFocus:
      finalFocus ??
      (menuTrigger ? () => (menuTrigger.isConnected ? menuTrigger : true) : undefined),
    onOpen: setMenuTrigger,
  };
}

/** Its layout effect runs as the popup mounts, before the overlay moves focus into itself. */
export function MenuOpenerNotice({
  onOpen,
}: {
  onOpen: (menuTrigger: HTMLElement | null) => void;
}) {
  useLayoutEffect(() => {
    onOpen(getMenuTrigger(document.activeElement));
  }, [onOpen]);

  return null;
}
