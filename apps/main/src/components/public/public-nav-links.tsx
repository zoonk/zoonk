import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

/** A page link in the public bar: quiet, so the bar's one action leads. */
const NAV_LINK_CLASS = cn(
  buttonVariants({ size: "bar", variant: "ghost" }),
  "text-muted-foreground hover:text-foreground px-3",
);

/** Pricing, from any bar a visitor sees: the public pages' and the app frame's. */
export async function PricingBarLink({ className }: { className?: string }) {
  const t = await getExtracted();

  return (
    <Link className={cn(NAV_LINK_CLASS, className)} href="/pricing">
      {t("Pricing")}
    </Link>
  );
}

/**
 * The public bar's pages: the courses (from tablet widths, where there's room; the footer and the
 * catalog's links have them on phones) and pricing, so visitors and crawlers reach both from every
 * public page.
 */
export async function PublicNavLinks() {
  const t = await getExtracted();

  return (
    <>
      <Link className={cn(NAV_LINK_CLASS, "hidden sm:inline-flex")} href="/courses">
        {t("Courses")}
      </Link>
      <PricingBarLink />
    </>
  );
}
