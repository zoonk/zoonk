import {
  BreadcrumbItem,
  BreadcrumbPage,
} from "@zoonk/ui/components/breadcrumb";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { AppBreadcrumb, HomeLinkBreadcrumb } from "@/components/breadcrumb";
import { VisualImageTestForm } from "./form";

export default function VisualImageTestPage() {
  return (
    <Container>
      <AppBreadcrumb>
        <HomeLinkBreadcrumb />
        <BreadcrumbItem>
          <BreadcrumbPage>Visual Image Test</BreadcrumbPage>
        </BreadcrumbItem>
      </AppBreadcrumb>

      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>Step Visual Image Generator</ContainerTitle>
          <ContainerDescription>
            Test AI-generated images for step visual resources
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <VisualImageTestForm />
      </ContainerBody>
    </Container>
  );
}
