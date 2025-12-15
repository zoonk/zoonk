import {
  BreadcrumbItem,
  BreadcrumbPage,
} from "@zoonk/ui/components/breadcrumb";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { AppBreadcrumb, HomeLinkBreadcrumb } from "@/patterns/breadcrumb";
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
        <ContainerTitle>Course Thumbnail Generator</ContainerTitle>
        <ContainerDescription>
          Test AI-generated course thumbnails
        </ContainerDescription>
      </ContainerHeader>

      <ContainerBody>
        <ImageTestForm />
      </ContainerBody>
    </Container>
  );
}
