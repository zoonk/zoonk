import {
  Container,
  ContainerBody,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Course" };
}

export default async function CoursePage({
  params,
}: PageProps<"/[locale]/[orgSlug]/c/[lang]/[courseSlug]">) {
  const { locale, courseSlug } = await params;
  setRequestLocale(locale);

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerTitle>{courseSlug}</ContainerTitle>
      </ContainerHeader>

      <ContainerBody>{}</ContainerBody>
    </Container>
  );
}
