"use client";

import { usePathname } from "next/navigation";
import { TabNav } from "../../_components/tab-nav";
import { DESIGN_PAGES } from "./pages";

/** A scrolling row under `lg`, which reaches the screen's edges, and a list beside the page above. */
export function DesignNav() {
  const pathname = usePathname();

  return (
    <TabNav
      className="max-lg:-mx-4 max-lg:-my-1.5 max-lg:overflow-x-auto max-lg:px-1.5 max-lg:py-1.5 lg:sticky lg:top-6 lg:flex-col lg:self-start"
      label="Design system"
      options={DESIGN_PAGES.map((page) => ({ ...page, isActive: pathname === page.href }))}
    />
  );
}
