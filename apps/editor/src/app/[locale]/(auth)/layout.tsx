import { buttonVariants } from "@zoonk/ui/components/button";
import { Container } from "@zoonk/ui/components/container";
import { LoginNav } from "@zoonk/ui/patterns/auth/login";
import { cacheTagLogin } from "@zoonk/utils/cache";
import { HomeIcon } from "lucide-react";
import { cacheLife, cacheTag } from "next/cache";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function AuthLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  "use cache";

  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, cacheTagLogin());

  const t = await getExtracted();

  return (
    <Container variant="centered">
      <LoginNav>
        <Link
          className={buttonVariants({ size: "icon", variant: "outline" })}
          href="/"
          prefetch={true}
        >
          <HomeIcon aria-hidden="true" />
          <span className="sr-only">{t("Home page")}</span>
        </Link>
      </LoginNav>

      {children}
    </Container>
  );
}
