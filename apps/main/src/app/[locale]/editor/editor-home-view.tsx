import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { EditorHeader } from "@/components/editor/editor-header";
import {
  OrganizationList,
  OrganizationListSkeleton,
} from "@/components/editor/organization-list";

export async function EditorHomeView() {
  const t = await getExtracted();

  return (
    <>
      <Container className="mx-auto w-full max-w-2xl pb-24">
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

      <EditorHeader />
    </>
  );
}
