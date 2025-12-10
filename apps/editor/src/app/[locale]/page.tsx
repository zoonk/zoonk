import { auth } from "@zoonk/auth";
import type { Organization } from "@zoonk/core";
import { getSession } from "@zoonk/core/users";
import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { headers } from "next/headers";
import { unauthorized } from "next/navigation";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { EditorNavbar } from "@/components/navbar";
import {
  OrganizationList,
  OrganizationListSkeleton,
} from "@/components/organization-list";
import { redirect } from "@/i18n/navigation";

async function EditorHeader() {
  const t = await getExtracted();

  return (
    <ContainerHeader className="text-center">
      <ContainerTitle>{t("Select an organization")}</ContainerTitle>
      <ContainerDescription>
        {t("Choose an organization to manage its courses")}
      </ContainerDescription>
    </ContainerHeader>
  );
}

async function EditorHomeView({
  locale,
  organizations,
}: {
  locale: string;
  organizations: Organization[];
}) {
  "use cache";

  setRequestLocale(locale);

  return (
    <Suspense>
      <EditorNavbar active="home" />

      <Container variant="narrow">
        <EditorHeader />

        <Suspense fallback={<OrganizationListSkeleton />}>
          <OrganizationList organizations={organizations} />
        </Suspense>
      </Container>
    </Suspense>
  );
}

async function listOrganizations() {
  return auth.api.listOrganizations({
    headers: await headers(),
  });
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  const [session, organizations] = await Promise.all([
    getSession(),
    listOrganizations(),
  ]);

  if (!session) {
    return redirect({ href: "/login", locale });
  }

  // temporarily restrict access to app admins only
  // in the future, we will allow any logged-in user to access the editor
  const isAdmin = session.user.role === "admin";

  if (!isAdmin) {
    unauthorized();
  }

  return (
    <Suspense>
      <EditorHomeView locale={locale} organizations={organizations as any} />
    </Suspense>
  );
}
