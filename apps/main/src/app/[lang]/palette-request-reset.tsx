"use client";

import { dropPendingCommandPalette } from "@/app/[lang]/(app)/(catalog)/_components/command-palette-event";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/** Only a real change of page drops the request: StrictMode's extra effect run in development keeps the page it saw. */
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
