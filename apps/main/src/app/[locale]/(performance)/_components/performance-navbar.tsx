"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { HomeIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Link } from "@/i18n/navigation";
import { MetricPills } from "./metric-pills";

export function PerformanceNavbar() {
  const t = useExtracted();

  return (
    <nav className="sticky top-0 z-10 flex w-full items-center gap-2 bg-background/95 px-4 pt-4 backdrop-blur supports-backdrop-filter:bg-background/60">
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
