import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";

export async function getGoalExample(): Promise<string> {
  const t = await getExtracted();
  const language = await lang();

  return language === "pt"
    ? t("get ready for the ENEM in November")
    : t({
        description:
          "An example goal a learner might type, short enough to fit on one line beside a button. In Brazilian Portuguese: “virar analista de dados até junho”.",
        message: "become a data analyst by June",
      });
}
