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
import { ImageTestForm } from "./form";

export default function ImageTestPage() {
  return (
    <Container>
      <AppBreadcrumb>
        <HomeLinkBreadcrumb />
        <BreadcrumbItem>
          <BreadcrumbPage>Image Test</BreadcrumbPage>
        </BreadcrumbItem>
      </AppBreadcrumb>

      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>Course Thumbnail Generator</ContainerTitle>
          <ContainerDescription>Test AI-generated course thumbnails</ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <ImageTestForm />
      </ContainerBody>
    </Container>
  );
}
