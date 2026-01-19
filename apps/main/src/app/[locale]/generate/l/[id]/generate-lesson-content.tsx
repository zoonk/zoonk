import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";

export async function GenerateLessonContent({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const t = await getExtracted();

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Generate Lesson Activities")}</ContainerTitle>
          <ContainerDescription>
            {t("This page is under construction.")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <p className="text-muted-foreground text-sm">
          {t("Lesson ID: {id}", { id })}
        </p>
      </ContainerBody>
    </Container>
  );
}

export function GenerateLessonFallback() {
  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-1 h-4 w-72" />
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Skeleton className="h-8 w-full rounded-xl" />
      </ContainerBody>
    </Container>
  );
}
