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

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/accuracy">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "Track your accuracy over time and see your best days and peak times.",
    ),
    title: t("Accuracy"),
  };
}

export default async function AccuracyPage({
  params,
}: PageProps<"/[locale]/accuracy">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getExtracted();

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Accuracy")}</ContainerTitle>
          <ContainerDescription>
            {t("Track your accuracy and performance trends")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-muted-foreground">
          {t("Coming soon")}
        </div>
      </ContainerBody>
    </Container>
  );
}
