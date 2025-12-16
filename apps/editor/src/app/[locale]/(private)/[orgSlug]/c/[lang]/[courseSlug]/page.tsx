import {
  Container,
  ContainerHeader,
  ContainerHeaderGroup,
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
        <ContainerHeaderGroup>
          <ContainerTitle>{courseSlug}</ContainerTitle>
        </ContainerHeaderGroup>
      </ContainerHeader>
    </Container>
  );
}
