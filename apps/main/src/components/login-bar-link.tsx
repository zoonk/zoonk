import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { PricingBarLink } from "@/components/public/public-nav-links";
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

export function VisitorBarLinks({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <PricingBarLink className="max-sm:group-data-title-away/page-bar:hidden @max-2xs/page-bar:hidden" />
      <LoginBarLink edge="end" />
    </div>
  );
}
