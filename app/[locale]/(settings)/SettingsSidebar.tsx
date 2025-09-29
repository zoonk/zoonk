import { getTranslations } from "next-intl/server";
import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { SettingsSidebarAccount } from "./SettingsSidebarAccount";
import { SettingsSidebarFooter } from "./SettingsSidebarFooter";
import { SettingsSidebarHeader } from "./SettingsSidebarHeader";

export async function SettingsSidebar() {
  const t = await getTranslations("Menu");

  return (
    <Sidebar
      collapsible="icon"
      title={t("settingsSidebarTitle")}
      description={t("settingsSidebarDescription")}
      closeLabel={t("close")}
    >
      <SettingsSidebarHeader />

      <SidebarContent>
        <SettingsSidebarAccount />
      </SidebarContent>

      <SettingsSidebarFooter />
    </Sidebar>
  );
}
