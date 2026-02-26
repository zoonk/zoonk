"use client";

import Link from "next/link";
import { buttonVariants } from "@zoonk/ui/components/button";
import { HorizontalScroll, HorizontalScrollContent } from "@zoonk/ui/components/horizontal-scroll";
import { HomeIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { MetricPillLinks } from "./metric-pills";

export function PerformanceNavbar() {
  const t = useExtracted();

  return (
    <nav className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-10 pt-4 backdrop-blur">
      <HorizontalScroll>
        <HorizontalScrollContent>
          <Link className={buttonVariants({ size: "icon", variant: "outline" })} href="/">
            <HomeIcon aria-hidden="true" />
            <span className="sr-only">{t("Home page")}</span>
          </Link>

          <MetricPillLinks />
        </HorizontalScrollContent>
      </HorizontalScroll>
    </nav>
  );
}
