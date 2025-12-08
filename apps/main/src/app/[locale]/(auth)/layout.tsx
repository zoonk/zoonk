"use cache";

import { buttonVariants } from "@zoonk/ui/components/button";
import { FullPageContainer } from "@zoonk/ui/components/container";
import { cacheTagLogin } from "@zoonk/utils/cache";
import { cacheLife, cacheTag } from "next/cache";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";

const homeMenu = getMenu("home");

export default async function AuthLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, cacheTagLogin());

  const t = await getExtracted();

  return (
    <FullPageContainer>
      <nav className="fixed top-4 left-4">
        <Link
          className={buttonVariants({ size: "icon", variant: "outline" })}
          href={homeMenu.url}
        >
          <homeMenu.icon aria-hidden="true" />
          <span className="sr-only">{t("Home page")}</span>
        </Link>
      </nav>

      {children}
    </FullPageContainer>
  );
}
