import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";

export async function getGoalExample(): Promise<string> {
  const t = await getExtracted();
  const language = await lang();

  return language === "pt"
    ? t("get ready for the ENEM in November")
    : t("get promoted to data analyst by June");
}
