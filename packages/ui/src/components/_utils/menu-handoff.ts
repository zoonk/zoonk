"use client";

import { type Dialog } from "@base-ui/react/dialog";
import { useCallback, useLayoutEffect, useState } from "react";

type FinalFocus = Dialog.Popup.Props["finalFocus"];

/** Base UI labels a menu's popup by its trigger. */
function getMenuTrigger(element: Element | null): HTMLElement | null {
  const triggerId = element?.closest("[role=menu]")?.getAttribute("aria-labelledby");
  return triggerId ? document.querySelector<HTMLElement>(`#${CSS.escape(triggerId)}`) : null;
}

/**
 * Focus has left a menu when it's on something other than the menu or its own trigger, such as a
 * sheet one of its items opened or another menu. A menu closed before its popup took focus leaves
 * it on the trigger. By then the popup is gone from the page, so it's the one kept from its mount.
 */
function hasLeftMenu(popup: HTMLElement | null): boolean {
  const focused = document.activeElement;

  if (!focused || focused === document.body || !popup) {
    return false;
  }

  return !popup.contains(focused) && focused !== getMenuTrigger(popup);
}

/**
 * A menu's own `finalFocus` gives way when focus has already left the menu. Base UI does that only
 * for its default. Put the returned `popupRef` on the menu's popup.
 */
export function useYieldMenuFocus(finalFocus: FinalFocus) {
  const [popup, setPopup] = useState<HTMLElement | null>(null);

  const popupRef = useCallback((node: HTMLElement | null) => {
    if (node) {
      setPopup(node);
    }
  }, []);

  if (finalFocus === undefined || typeof finalFocus === "boolean") {
    return { finalFocus, popupRef };
  }

  const yielding: FinalFocus = (closeType) => {
    if (hasLeftMenu(popup)) {
      return false;
    }

    return typeof finalFocus === "function" ? finalFocus(closeType) : finalFocus.current;
  };

  return { finalFocus: yielding, popupRef };
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

/**
 * Its layout effect runs as the popup mounts, before the overlay moves focus into itself, and lets
 * the trigger go when the popup unmounts, after the overlay has read where focus returns.
 */
export function MenuOpenerNotice({
  onOpen,
}: {
  onOpen: (menuTrigger: HTMLElement | null) => void;
}) {
  useLayoutEffect(() => {
    onOpen(getMenuTrigger(document.activeElement));
    return () => onOpen(null);
  }, [onOpen]);

  return null;
}
