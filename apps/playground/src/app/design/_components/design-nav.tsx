"use client";

import { HorizontalScroll } from "@zoonk/ui/components/horizontal-scroll";
import { usePathname } from "next/navigation";
import { TabNav } from "../../_components/tab-nav";
import { SCROLL_LABELS } from "../../_utils/scroll-labels";
import { DESIGN_PAGES } from "./pages";

/** A scrolling row under `lg`, which reaches the screen's edges, and a list beside the page above. */
export function DesignNav() {
  const pathname = usePathname();

  return (
    <HorizontalScroll
      className="max-lg:-mx-4 max-lg:-my-1.5 lg:sticky lg:top-6 lg:-mx-2.5 lg:self-start"
      labels={SCROLL_LABELS}
    >
      <TabNav
        className="mx-0 w-max min-w-full max-lg:px-1.5 max-lg:py-1.5 lg:w-auto lg:flex-col"
        label="Design system"
        options={DESIGN_PAGES.map((page) => ({ ...page, isActive: pathname === page.href }))}
      />
    </HorizontalScroll>
  );
}
