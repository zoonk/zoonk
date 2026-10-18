import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { PricingBarLink } from "@/components/public/public-nav-links";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

/**
 * A visitor's way in: in every top bar (the landing's, a public page's, the app's), a quiet button
 * as tall as the bar's other controls, the same beside "Pricing" as beside "Start free"; in the
 * sidebar's foot (`outline`), the foot's one button.
 */
export async function LoginBarLink({
  className,
  variant = "ghost",
}: {
  className?: string;
  variant?: "ghost" | "outline";
}) {
  const t = await getExtracted();

  return (
    <CurrentPageLoginLink className={cn(buttonVariants({ size: "bar", variant }), className)}>
      {t("Log in")}
    </CurrentPageLoginLink>
  );
}

/**
 * A visitor's end of an app bar under `lg`: what Zoonk costs, then the way in. From `lg` the
 * sidebar's foot has both. Pricing gives way on a phone once a page's name joins the bar, so a
 * course's name reads whole there; it's back at the top of the page.
 */
export function VisitorBarLinks({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <PricingBarLink className="max-sm:group-data-title-away/page-bar:hidden" />
      <LoginBarLink />
    </div>
  );
}
