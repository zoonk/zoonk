"use client";

import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { HomeIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { MetricPills } from "./metric-pills";

export function PerformanceNavbar() {
  const t = useExtracted();

  return (
    <nav className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-10 flex w-full items-center gap-2 px-4 pt-4 backdrop-blur">
      <Link
        className={buttonVariants({
          size: "icon",
          variant: "outline",
        })}
        href="/"
      >
        <HomeIcon aria-hidden="true" />
        <span className="sr-only">{t("Home page")}</span>
      </Link>

      <MetricPills />
    </nav>
  );
}
