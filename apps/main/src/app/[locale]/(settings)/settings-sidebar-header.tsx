import { SidebarHeader, SidebarTrigger } from "@zoonk/ui/components/sidebar";
import { getExtracted } from "next-intl/server";

export async function SettingsSidebarHeader() {
  const t = await getExtracted();

  return (
    <SidebarHeader>
      <SidebarTrigger toggleLabel={t("Toggle sidebar")} />
    </SidebarHeader>
  );
}
