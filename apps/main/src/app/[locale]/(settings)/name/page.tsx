"use cache";

import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { ProtectedSection } from "../_components/protected-section";
import { NameForm } from "./name-form";
import type { Metadata } from "next";

export async function generateMetadata({ params }: PageProps<"/[locale]/name">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "Set or update your Zoonk display name. This name may be visible to others and will be used when referring to you in lessons and activities.",
    ),
    title: t("Update Display Name"),
  };
}

export default async function Name({ params }: PageProps<"/[locale]/name">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getExtracted();

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Display name")}</ContainerTitle>
          <ContainerDescription>
            {t(
              "This is the name others may see and the one we'll use to refer to you in activities.",
            )}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <ProtectedSection>
          <NameForm />
        </ProtectedSection>
      </ContainerBody>
    </Container>
  );
}
