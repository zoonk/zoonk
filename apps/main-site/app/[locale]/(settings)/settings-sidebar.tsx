import { Sidebar, SidebarContent } from "@zoonk/ui/components/sidebar";
import { getTranslations } from "next-intl/server";
import { SettingsSidebarAccount } from "./settings-sidebar-account";
import { SettingsSidebarFooter } from "./settings-sidebar-footer";
import { SettingsSidebarHeader } from "./settings-sidebar-header";

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
