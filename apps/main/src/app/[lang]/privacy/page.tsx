import { LegalDocument } from "@/components/public/legal-document";
import { type Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Read Zoonk's privacy policy to understand how we use and protect your personal information.",
    ),
    title: t("Privacy Policy"),
  };
}

export default async function Privacy() {
  const locale = await getLocale();
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- dynamic import returns any
  const { default: PrivacyPolicy } = await import(`./${locale}.mdx`);

  return (
    <LegalDocument>
      <PrivacyPolicy />
    </LegalDocument>
  );
}
