import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@zoonk/ui/components/breadcrumb";
import {
  Container,
  ContainerBody,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import Link from "next/link";
import { AdminPeriodTabs } from "./admin-period-tabs";

function StatsBreadcrumb({ title }: { title: string }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/" />}>Dashboard</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/stats" />}>Stats</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function StatsPageLayout({
  children,
  navigation,
  title,
}: {
  children: React.ReactNode;
  navigation?: React.ReactNode;
  title: string;
}) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup className="flex-1">
          <StatsBreadcrumb title={title} />
          <ContainerTitle>{title}</ContainerTitle>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
            <AdminPeriodTabs />
            {navigation}
          </div>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>{children}</ContainerBody>
    </Container>
  );
}
