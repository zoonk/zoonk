import { AdminHeader } from "@/components/admin-header";
import { AdminPage, AdminPageBody } from "@/components/admin-page";
import { ContainerTitle } from "@zoonk/ui/components/container";
import { StatsBreadcrumb, type StatsBreadcrumbItem } from "./stats-breadcrumb";

export function StatsPageLayout({
  breadcrumbItems,
  children,
  title,
}: {
  breadcrumbItems: StatsBreadcrumbItem[];
  children: React.ReactNode;
  title: string;
}) {
  return (
    <AdminPage>
      <AdminHeader
        crumb={<StatsBreadcrumb items={breadcrumbItems} />}
        title={<ContainerTitle>{title}</ContainerTitle>}
      />

      <AdminPageBody>{children}</AdminPageBody>
    </AdminPage>
  );
}
