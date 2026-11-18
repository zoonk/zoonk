import { getExtracted } from "next-intl/server";

const COMPANY_NUMBER = "42.262.784/0001-76";

export async function LegalCompanyNumber() {
  const t = await getExtracted();

  return (
    <>
      <strong>{t("Brazilian company number (CNPJ):")}</strong> {COMPANY_NUMBER}
    </>
  );
}
