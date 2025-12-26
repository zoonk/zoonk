"use cache";

import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import type { Metadata } from "next";
import { getExtracted, setRequestLocale } from "next-intl/server";
import LocaleSwitcher from "../_components/locale-switcher";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/language">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "Update your Zoonk app language to learn in English, Portuguese, Spanish, French, or other supported languages.",
    ),
    title: t("Update language"),
  };
}

export default async function Language({
  params,
}: PageProps<"/[locale]/language">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getExtracted();

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Language")}</ContainerTitle>
          <ContainerDescription>
            {t("Choose the app language you prefer for this device.")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <LocaleSwitcher />
      </ContainerBody>
    </Container>
  );
}
