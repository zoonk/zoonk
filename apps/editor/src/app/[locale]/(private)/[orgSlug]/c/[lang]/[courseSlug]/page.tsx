import {
  Container,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";

// this page is just a placeholder for now
export default async function CoursePage({
  params,
}: PageProps<"/[locale]/[orgSlug]/c/[lang]/[courseSlug]">) {
  const { courseSlug } = await params;

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerTitle>{courseSlug}</ContainerTitle>
      </ContainerHeader>
    </Container>
  );
}
