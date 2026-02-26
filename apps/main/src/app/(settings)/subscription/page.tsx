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
import { Suspense } from "react";
import { ProtectedSection } from "../_components/protected-section";
import { SubscriptionPlans, SubscriptionPlansSkeleton } from "./subscription-plans";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/subscription">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "Compare plans and manage your Zoonk subscription. See pricing, switch plans, or update billing.",
    ),
    title: t("Subscription"),
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
            {t("Compare plans and manage your subscription.")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <ProtectedSection>
          <Suspense fallback={<SubscriptionPlansSkeleton />}>
            <SubscriptionPlans />
          </Suspense>
        </ProtectedSection>
      </ContainerBody>
    </Container>
  );
}
