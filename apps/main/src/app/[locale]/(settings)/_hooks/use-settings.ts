import { getMenu } from "@/lib/menu";
import { useExtracted } from "next-intl";

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
    { key: "support", label: t("Support"), ...getMenu("support") },
  ];

  return { menuPages };
}
