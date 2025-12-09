import { getSession } from "@zoonk/core/users";
import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { redirect, unauthorized } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { EditorNavbar } from "@/components/navbar";
import {
  OrganizationList,
  OrganizationListSkeleton,
} from "@/components/organization-list";

export default async function HomePage() {
  const session = await getSession();
  const t = await getExtracted();

  if (!session) {
    redirect("/login");
  }

  // temporarily restrict access to app admins only
  // in the future, we will allow any logged-in user to access the editor
  const isAdmin = session.user.role === "admin";

  if (!isAdmin) {
    unauthorized();
  }

  return (
    <>
      <EditorNavbar active="home" />

      <Container variant="narrow">
        <ContainerHeader className="text-center">
          <ContainerTitle>{t("Select an organization")}</ContainerTitle>
          <ContainerDescription>
            {t("Choose an organization to manage its courses")}
          </ContainerDescription>
        </ContainerHeader>

        <Suspense fallback={<OrganizationListSkeleton />}>
          <OrganizationList />
        </Suspense>
      </Container>
    </>
  );
}
