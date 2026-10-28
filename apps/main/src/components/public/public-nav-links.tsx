import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

const NAV_LINK_CLASS = cn(
  buttonVariants({ size: "bar", variant: "ghost" }),
  "text-muted-foreground hover:text-foreground px-3",
);

export async function PricingBarLink({ className }: { className?: string }) {
  const t = await getExtracted();

  return (
    <Link className={cn(NAV_LINK_CLASS, className)} href="/pricing">
      {t("Pricing")}
    </Link>
  );
}

/** So visitors and crawlers reach both from every public page. */
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
