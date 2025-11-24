"use client";

import {
  NativeSelect,
  NativeSelectOption,
} from "@zoonk/ui/components/native-select";
import { useExtracted } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";

export function SettingsNavigation() {
  const t = useExtracted();
  const pathname = usePathname();
  const router = useRouter();

  const menuItems = [
    { key: "settings", label: t("Settings"), ...getMenu("settings") },
    {
      key: "subscription",
      label: t("Subscription"),
      ...getMenu("subscription"),
    },
    { key: "displayName", label: t("Display name"), ...getMenu("displayName") },
    { key: "language", label: t("Language"), ...getMenu("language") },
    { key: "feedback", label: t("Feedback"), ...getMenu("feedback") },
    { key: "help", label: t("Help"), ...getMenu("help") },
    { key: "follow", label: t("Follow us"), ...getMenu("follow") },
  ];

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedUrl = event.target.value;
    router.push(selectedUrl);
  };

  return (
    <NativeSelect
      aria-label={t("Navigate settings")}
      onChange={handleChange}
      value={pathname}
    >
      {menuItems.map((item) => (
        <NativeSelectOption key={item.key} value={item.url}>
          {item.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
