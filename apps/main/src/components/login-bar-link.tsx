import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { CoursesBarLink, PricingBarLink } from "@/components/public/public-nav-links";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { LogInIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

export async function LoginBarLink({
  className,
  edge,
  variant = "ghost",
}: {
  className?: string;
  edge?: "end";
  variant?: "ghost" | "outline";
}) {
  const t = await getExtracted();

  return (
    <CurrentPageLoginLink
      className={cn(buttonVariants({ edge, size: "bar", variant }), className)}
      icon={<LogInIcon aria-hidden="true" />}
    >
      {t("Log in")}
    </CurrentPageLoginLink>
  );
}

/** A bar short of room keeps "Log in" and lets these go. */
const NARROW_BAR_CLASS = "max-sm:group-data-title-away/page-bar:hidden max-[20rem]:hidden";

/** What someone without a session can use from a bar: the catalog, the prices and the way in. */
export function VisitorBarLinks({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <CoursesBarLink className={NARROW_BAR_CLASS} />
      <PricingBarLink className={NARROW_BAR_CLASS} />
      <LoginBarLink edge="end" />
    </div>
  );
}
