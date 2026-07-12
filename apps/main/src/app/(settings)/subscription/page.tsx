import { Badge } from "@zoonk/ui/components/badge";
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
import { Suspense } from "react";
import { SubscriptionPlans, SubscriptionPlansSkeleton } from "./subscription-plans";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Learn anything with AI. Create as many courses and take as many lessons as you want with Zoonk Plus.",
    ),
    title: t("Zoonk Plus: Unlimited courses and lessons"),
  };
}

export default async function Subscription({ searchParams }: PageProps<"/subscription">) {
  const t = await getExtracted();

  return (
    <Container className="mx-auto gap-8 py-4 sm:max-w-5xl sm:py-8 lg:gap-10 lg:py-10">
      <ContainerHeader className="items-start">
        <ContainerHeaderGroup className="max-w-3xl gap-4">
          <Badge variant="outline">{t("Zoonk Plus")}</Badge>

          <ContainerTitle className="text-4xl leading-[0.95] font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl">
            {t("Learn anything. It’s all included.")}
          </ContainerTitle>

          <ContainerDescription className="max-w-2xl text-base leading-relaxed sm:text-lg">
            {t(
              "Pass the test. Get a better job. Speak a language. Whatever you want to achieve, Plus gives you unlimited courses and lessons to help you get there.",
            )}
          </ContainerDescription>

          <p className="text-muted-foreground pt-2 font-mono text-xs tracking-wide text-pretty uppercase">
            {t("Any subject · Unlimited courses and lessons")}
          </p>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="sm:px-4">
        <Suspense fallback={<SubscriptionPlansSkeleton />}>
          <SubscriptionPlans searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
