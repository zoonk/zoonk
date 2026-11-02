import { LoginBarLink } from "@/components/login-bar-link";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

export async function PublicVisitorActions() {
  const t = await getExtracted();

  return (
    <>
      <LoginBarLink />
      <Link className={cn(buttonVariants({ size: "bar" }), "hidden sm:inline-flex")} href="/start">
        {t("Start free")}
      </Link>
    </>
  );
}
