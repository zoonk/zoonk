import { SidebarHeader, SidebarTrigger } from "@zoonk/ui/components/sidebar";
import { getTranslations } from "next-intl/server";

export async function SettingsSidebarHeader() {
  const t = await getTranslations("Menu");

  return (
    <SidebarHeader>
      <SidebarTrigger toggleLabel={t("toggleSidebar")} />
    </SidebarHeader>
  );
}
