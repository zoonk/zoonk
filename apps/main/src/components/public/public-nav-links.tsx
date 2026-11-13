import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

const NAV_LINK_CLASS = cn(
  buttonVariants({ size: "bar", variant: "ghost" }),
  "text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground px-3",
);

export async function PricingBarLink({
  className,
  current = false,
}: {
  className?: string;
  current?: boolean;
}) {
  const t = await getExtracted();

  return (
    <Link
      aria-current={current ? "page" : undefined}
      className={cn(NAV_LINK_CLASS, className)}
      href="/pricing"
    >
      {t("Pricing")}
    </Link>
  );
}

export async function CoursesBarLink({ className }: { className?: string }) {
  const t = await getExtracted();

  return (
    <Link className={cn(NAV_LINK_CLASS, className)} href="/courses">
      {t("Courses")}
    </Link>
  );
}

/** So visitors and crawlers reach both from every public page. */
export function PublicNavLinks({ pathname }: { pathname?: string }) {
  return (
    <>
      <CoursesBarLink className="hidden sm:inline-flex" />
      <PricingBarLink current={pathname === "/pricing"} />
    </>
  );
}
