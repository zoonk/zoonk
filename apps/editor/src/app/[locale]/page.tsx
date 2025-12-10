"use cache";

import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { EditorNavbar } from "@/components/navbar";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getExtracted();

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
      </Container>
    </>
  );
}
