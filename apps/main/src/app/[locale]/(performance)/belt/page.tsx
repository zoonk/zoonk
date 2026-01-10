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
}: PageProps<"/[locale]/belt">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t("Track your belt level progress and see how you advance."),
    title: t("Belt Level"),
  };
}

export default async function BeltPage({
  params,
}: PageProps<"/[locale]/belt">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getExtracted();

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Belt Level")}</ContainerTitle>
          <ContainerDescription>
            {t("Track your belt level progress")}
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
