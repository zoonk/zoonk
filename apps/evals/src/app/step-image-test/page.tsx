import { AppBreadcrumb, HomeLinkBreadcrumb } from "@/components/breadcrumb";
import { BreadcrumbItem, BreadcrumbPage } from "@zoonk/ui/components/breadcrumb";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { StepImageTestForm } from "./form";

export default function StepImageTestPage() {
  return (
    <Container>
      <AppBreadcrumb>
        <HomeLinkBreadcrumb />
        <BreadcrumbItem>
          <BreadcrumbPage>Step Image Test</BreadcrumbPage>
        </BreadcrumbItem>
      </AppBreadcrumb>

      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>Step Image Generator</ContainerTitle>
          <ContainerDescription>
            Test AI-generated images for lesson step illustrations
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <StepImageTestForm />
      </ContainerBody>
    </Container>
  );
}
