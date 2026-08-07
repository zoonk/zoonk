import {
  Container,
  ContainerBody,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { StatsBreadcrumb, type StatsBreadcrumbItem } from "./stats-breadcrumb";

/**
 * Stats drill-down pages share the same container and breadcrumb structure.
 * Centralizing that shell keeps each page focused on its content instead of
 * reimplementing layout chrome.
 */
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
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup className="flex-1">
          <StatsBreadcrumb items={breadcrumbItems} />
          <ContainerTitle>{title}</ContainerTitle>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>{children}</ContainerBody>
    </Container>
  );
}
