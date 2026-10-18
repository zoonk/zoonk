import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";

/**
 * The example a goal box shows outside the landing (Explore, a Plan without a goal): one goal in a
 * visitor's words, with its date, local to the page's language, as the landing's examples are.
 */
export async function getGoalExample(): Promise<string> {
  const t = await getExtracted();
  const language = await lang();

  return language === "pt"
    ? t("get ready for the ENEM in November")
    : t("get promoted to data analyst by June");
}
