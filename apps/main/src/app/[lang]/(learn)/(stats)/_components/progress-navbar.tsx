import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { HorizontalScroll, HorizontalScrollContent } from "@zoonk/ui/components/horizontal-scroll";
import { ArrowLeftIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { MetricPillLinks } from "./metric-pills";

/**
 * The stats pages sit under Progress in the learning tabs: a way back to Progress, then one pill
 * per stat. The tabs above already hold the rest of the navigation.
 */
export async function ProgressNavbar() {
  const t = await getExtracted();

  return (
    <nav aria-label={t("Your stats")} className="-mx-4 pb-4">
      <HorizontalScroll>
        <HorizontalScrollContent>
          <Link
            className={buttonVariants({ size: "icon", variant: "outline" })}
            href="/progress"
            prefetch
          >
            <ArrowLeftIcon aria-hidden="true" />
            <span className="sr-only">{t("Progress")}</span>
          </Link>

          <MetricPillLinks />
        </HorizontalScrollContent>
      </HorizontalScroll>
    </nav>
  );
}
