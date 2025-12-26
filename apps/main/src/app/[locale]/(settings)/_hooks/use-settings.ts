import { useExtracted } from "next-intl";
import { getMenu } from "@/lib/menu";

export function useSettings() {
  const t = useExtracted();

  const menuPages = [
    {
      key: "subscription",
      label: t("Subscription"),
      ...getMenu("subscription"),
    },
    { key: "language", label: t("Language"), ...getMenu("language") },
    { key: "displayName", label: t("Display name"), ...getMenu("displayName") },
    { key: "feedback", label: t("Feedback"), ...getMenu("feedback") },
    { key: "help", label: t("Help"), ...getMenu("help") },
    { key: "follow", label: t("Follow us"), ...getMenu("follow") },
  ];

  return { menuPages };
}
