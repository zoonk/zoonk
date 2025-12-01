"use client";

import {
  NativeSelect,
  NativeSelectOption,
} from "@zoonk/ui/components/native-select";
import { useExtracted } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { useSettings } from "./use-settings";

export function SettingsNavigation() {
  const t = useExtracted();
  const pathname = usePathname();
  const router = useRouter();
  const { menuPages } = useSettings();

  const menuItems = [
    { key: "settings", label: t("Settings"), ...getMenu("settings") },
    ...menuPages,
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
