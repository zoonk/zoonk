import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import {
  CourseList,
  CourseListSkeleton,
} from "@/components/editor/course-list";
import { EditorHeader } from "@/components/editor/editor-header";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/editor/[orgSlug]">): Promise<Metadata> {
  "use cache";

  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    title: t("Editor"),
  };
}

export default async function EditorOverview({
  params,
}: PageProps<"/[locale]/editor/[orgSlug]">) {
  const { orgSlug } = await params;
  const t = await getExtracted();

  return (
    <>
      <EditorHeader active="overview" orgSlug={orgSlug} />

      <Container>
        <ContainerHeader>
          <ContainerTitle>{t("Courses")}</ContainerTitle>
          <ContainerDescription>
            {t("Select a course to edit its content")}
          </ContainerDescription>
        </ContainerHeader>

        <Suspense fallback={<CourseListSkeleton />}>
          <CourseList orgSlug={orgSlug} />
        </Suspense>
      </Container>
    </>
  );
}
