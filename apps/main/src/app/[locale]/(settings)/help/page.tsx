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
import { ContactForm } from "@/components/feedback/contact-form";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/help">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "Need help with Zoonk? Contact our support or browse the FAQ to quickly find answers to common questions.",
    ),
    title: t("Help & Support"),
  };
}

export default async function Help({ params }: PageProps<"/[locale]/help">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getExtracted();

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Help")}</ContainerTitle>

          <ContainerDescription>
            {t(
              "Get support and answers. Fill in the form below or email us directly at hello@zoonk.com.",
            )}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <ContactForm />
      </ContainerBody>
    </Container>
  );
}
