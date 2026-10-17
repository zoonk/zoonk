"use client";

import { dropPendingCommandPalette } from "@/app/[lang]/(app)/(catalog)/_components/command-palette-event";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Forgets a "Search" the learner chose before the palette streamed in once they move to another
 * page (the committed URL, as the palette itself resets on), so a palette arriving later never
 * opens on a page they left or came back to. Only a real change of page drops it: StrictMode's
 * extra effect run in development keeps the page it saw.
 */
export function PaletteRequestReset() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = `${pathname}?${searchParams.toString()}`;
  const seen = useRef(page);

  useEffect(() => {
    if (seen.current === page) {
      return;
    }

    seen.current = page;
    dropPendingCommandPalette();
  }, [page]);

  return null;
}
