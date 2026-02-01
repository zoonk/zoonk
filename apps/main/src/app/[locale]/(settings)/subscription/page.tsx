"use cache";

import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { ProtectedSection } from "../_components/protected-section";
import { SubscriptionPage } from "./subscription-page";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/subscription">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "Manage your Zoonk subscription. View your current plan, upgrade or downgrade, and see available benefits.",
    ),
    title: t("Manage Subscription"),
  };
}

export default async function Subscription({ params }: PageProps<"/[locale]/subscription">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getExtracted();

  return (
    <Container>
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Subscription")}</ContainerTitle>
          <ContainerDescription>
            {t("Check your plan details and manage your subscription.")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <ProtectedSection>
          <SubscriptionPage />
        </ProtectedSection>
      </ContainerBody>
    </Container>
  );
}
