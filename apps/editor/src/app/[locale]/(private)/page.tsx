import { findOrganizationById } from "@zoonk/core/organizations";
import { getSession, listUserOrgs } from "@zoonk/core/users";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { cn } from "@zoonk/ui/lib/utils";
import { ProtectedSection } from "@zoonk/ui/patterns/auth/protected-section";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { Link, redirect } from "@/i18n/navigation";
import {
  OrganizationList,
  OrganizationListSkeleton,
} from "./organization-list";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const [userSession, orgs] = await Promise.all([getSession(), listUserOrgs()]);
  const { locale } = await params;
  const t = await getExtracted();

  const userHasOnlyOneOrg = orgs.data.length === 1;

  // when users have only one organization, we redirect them to that organization
  if (userHasOnlyOneOrg) {
    redirect({ href: `/${orgs.data[0]?.slug}`, locale });
  }

  const activeOrganizationId = userSession?.session.activeOrganizationId;

  const activeOrganization = findOrganizationById(
    orgs.data,
    activeOrganizationId,
  );

  // when users have set an active organization, we redirect them to that organization
  // otherwise, we show the organization list to choose from
  if (activeOrganization) {
    redirect({ href: `/${activeOrganization.slug}`, locale });
  }

  return (
    <Container variant="centered">
      <ContainerHeader>
        <ContainerHeaderGroup className="text-center">
          <ContainerTitle>{t("Select an organization")}</ContainerTitle>

          <ContainerDescription>
            {t("Choose an organization to manage its courses")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ProtectedSection
        actions={
          <Link className={cn(buttonVariants())} href="/login">
            {t("Login")}
          </Link>
        }
        alertTitle={t("You need to be logged in to access this page.")}
        centered
        className="w-full"
        state={userSession ? "authenticated" : "unauthenticated"}
      >
        <Suspense fallback={<OrganizationListSkeleton />}>
          <OrganizationList organizations={orgs.data} />
        </Suspense>
      </ProtectedSection>
    </Container>
  );
}
