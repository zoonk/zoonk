import { getExtracted } from "next-intl/server";
import { getMenu } from "@/lib/menu";

export async function settingsMenu() {
  const t = await getExtracted();

  const settingsPages = [
    { label: t("Settings"), ...getMenu("settings") },
    { label: t("Subscription"), ...getMenu("subscription") },
    { label: t("Language"), ...getMenu("language") },
    { label: t("Display Name"), ...getMenu("displayName") },
    { label: t("Feedback"), ...getMenu("feedback") },
    { label: t("Help"), ...getMenu("help") },
    { label: t("Follow"), ...getMenu("follow") },
  ];

  return { settingsPages };
}
