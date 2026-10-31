import { LegalDocument } from "@/components/public/legal-document";
import { getAppLocale } from "@/i18n/locale";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";

export const ensureStatic = "navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Read Zoonk's terms of use to understand the rules and conditions for using our platform and services",
    ),
    title: t("Terms of Use"),
  };
}

export default async function Terms() {
  const locale = await getAppLocale();
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- dynamic import returns any
  const { default: TermsOfService } = await import(`./${locale}.mdx`);

  return (
    <LegalDocument pathname="/terms">
      <TermsOfService />
    </LegalDocument>
  );
}
