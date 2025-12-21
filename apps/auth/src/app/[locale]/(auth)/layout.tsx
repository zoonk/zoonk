import { Container } from "@zoonk/ui/components/container";
import { LoginNav } from "@zoonk/ui/patterns/auth/login";
import { cacheTagLogin } from "@zoonk/utils/cache";
import { cacheLife, cacheTag } from "next/cache";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";

async function AuthLinks({
  params,
}: {
  params: LayoutProps<"/[locale]">["params"];
}) {
  "use cache";

  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, cacheTagLogin());

  const t = await getExtracted();

  return (
    <Link className="text-muted-foreground text-sm hover:underline" href="/">
      {t("Zoonk")}
    </Link>
  );
}

export default function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: LayoutProps<"/[locale]">["params"];
}) {
  return (
    <Container variant="centered">
      <LoginNav>
        <Suspense fallback={null}>
          <AuthLinks params={params} />
        </Suspense>
      </LoginNav>

      {children}
    </Container>
  );
}
