"use client";

import { useEffect } from "react";

/**
 * The router scrolls to a hash as the page commits, before a part that streams in later exists. A page
 * already scrolled (a reader moving on, Back restoring their place) is left where it is.
 */
export function ScrollToAnchor({ id }: { id: string }) {
  useEffect(() => {
    if (globalThis.location.hash !== `#${id}` || globalThis.scrollY > 0) {
      return;
    }

    document.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ block: "start" });
  }, [id]);

  return null;
}
