import {
  Container,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Suspense } from "react";

async function CourseHeaderGroup({
  params,
}: {
  params: PageProps<"/[locale]/[orgSlug]/c/[lang]/[courseSlug]">["params"];
}) {
  const { courseSlug } = await params;

  return (
    <ContainerHeaderGroup>
      <ContainerTitle>{courseSlug}</ContainerTitle>
    </ContainerHeaderGroup>
  );
}

// this page is just a placeholder for now
export default async function CoursePage({
  params,
}: PageProps<"/[locale]/[orgSlug]/c/[lang]/[courseSlug]">) {
  return (
    <Container variant="narrow">
      <ContainerHeader>
        <Suspense>
          <CourseHeaderGroup params={params} />
        </Suspense>
      </ContainerHeader>
    </Container>
  );
}
