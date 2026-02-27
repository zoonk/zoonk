import { buttonVariants } from "@zoonk/ui/components/button";
import { HorizontalScroll, HorizontalScrollContent } from "@zoonk/ui/components/horizontal-scroll";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { HomeIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import Link from "next/link";
import { MetricPillLinks } from "./metric-pills";

export async function PerformanceNavbar() {
  const t = await getExtracted();

  return (
    <nav className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-10 pt-4 backdrop-blur">
      <HorizontalScroll>
        <HorizontalScrollContent>
          <Link className={buttonVariants({ size: "icon", variant: "outline" })} href="/" prefetch>
            <HomeIcon aria-hidden="true" />
            <span className="sr-only">{t("Home page")}</span>
          </Link>

          <MetricPillLinks />
        </HorizontalScrollContent>
      </HorizontalScroll>
    </nav>
  );
}

export function PerformanceNavbarSkeleton() {
  return (
    <nav className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-10 pt-4 backdrop-blur">
      <div className="flex gap-2 px-4">
        <Skeleton className="size-9 rounded-md" />
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>
    </nav>
  );
}
