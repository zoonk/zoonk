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
import { SelectImageTestForm } from "./form";

export default function SelectImageTestPage() {
  return (
    <Container>
      <AppBreadcrumb>
        <HomeLinkBreadcrumb />
        <BreadcrumbItem>
          <BreadcrumbPage>Select Image Test</BreadcrumbPage>
        </BreadcrumbItem>
      </AppBreadcrumb>

      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>Select Image Step Generator</ContainerTitle>
          <ContainerDescription>
            Test AI-generated images for selectImage quiz steps
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <SelectImageTestForm />
      </ContainerBody>
    </Container>
  );
}
