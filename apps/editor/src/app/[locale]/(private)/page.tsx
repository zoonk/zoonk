import { getSession, listUserOrgs } from "@zoonk/core/users";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { cn } from "@zoonk/ui/lib/utils";
import { ProtectedSection } from "@zoonk/ui/patterns/auth/protected-section";
import { cacheTagHome } from "@zoonk/utils/cache";
import { cacheLife, cacheTag } from "next/cache";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import {
  OrganizationList,
  OrganizationListSkeleton,
} from "@/components/organization-list";
import { Link } from "@/i18n/navigation";

async function HomeView({
  children,
  params,
}: {
  children: React.ReactNode;
  params: PageProps<"/[locale]">["params"];
}) {
  "use cache";

  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, cacheTagHome());

  const t = await getExtracted();

  return (
    <Container variant="narrow">
      <ContainerHeader className="text-center">
        <ContainerTitle>{t("Select an organization")}</ContainerTitle>
        <ContainerDescription>
          {t("Choose an organization to manage its courses")}
        </ContainerDescription>
      </ContainerHeader>

      {children}
    </Container>
  );
}

async function HomeOrgs() {
  const [session, orgs] = await Promise.all([getSession(), listUserOrgs()]);
  const t = await getExtracted();

  return (
    <ProtectedSection
      actions={
        <Link className={cn(buttonVariants())} href="/login">
          {t("Login")}
        </Link>
      }
      alertTitle={t("You need to be logged in to access this page.")}
      centered
      state={session ? "authenticated" : "unauthenticated"}
    >
      <OrganizationList organizations={orgs.data} />
    </ProtectedSection>
  );
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  return (
    <HomeView params={params}>
      <Suspense fallback={<OrganizationListSkeleton />}>
        <HomeOrgs />
      </Suspense>
    </HomeView>
  );
}
