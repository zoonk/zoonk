"use cache";

import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { cacheTagHelp } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { ContactForm } from "@/components/contact-form";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/help">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, cacheTagHelp());

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

  cacheLife("max");
  cacheTag(locale, cacheTagHelp());

  const t = await getExtracted();

  return (
    <Container>
      <ContainerHeader>
        <ContainerTitle>{t("Help")}</ContainerTitle>

        <ContainerDescription>
          {t(
            "Get support and answers. Fill in the form below or email us directly at hello@zoonk.com.",
          )}
        </ContainerDescription>
      </ContainerHeader>

      <ContactForm />
    </Container>
  );
}
