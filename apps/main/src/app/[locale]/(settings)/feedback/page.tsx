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
}: PageProps<"/[locale]/feedback">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "Share your thoughts and help improve Zoonk. Use the feedback page to contact us with suggestions, questions, or issues about our learning platform.",
    ),
    title: t("Send feedback"),
  };
}

export default async function Feedback({
  params,
}: PageProps<"/[locale]/feedback">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getExtracted();

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Feedback")}</ContainerTitle>
          <ContainerDescription>
            {t(
              "Send feedback, questions, or suggestions to us. Fill in the form below or email us directly at hello@zoonk.com.",
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
