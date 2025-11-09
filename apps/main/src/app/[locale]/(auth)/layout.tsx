"use cache";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cacheTagLogin } from "@zoonk/utils/cache";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
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

  const t = await getTranslations("Menu");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <nav className="fixed top-4 left-4">
        <Link
          className={buttonVariants({ size: "icon", variant: "outline" })}
          href={homeMenu.url}
        >
          <homeMenu.icon aria-hidden="true" />
          <span className="sr-only">{t("home")}</span>
        </Link>
      </nav>

      {children}
    </main>
  );
}
