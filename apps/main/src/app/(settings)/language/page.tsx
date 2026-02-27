import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { LocaleSwitcher } from "../_components/locale-switcher";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Update your Zoonk app language to learn in English, Portuguese, Spanish, French, or other supported languages.",
    ),
    title: t("Update language"),
  };
}

export default async function Language() {
  const t = await getExtracted();

  return (
    <Container>
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
