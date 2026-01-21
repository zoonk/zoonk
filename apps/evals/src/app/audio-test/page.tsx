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
import { AudioTestForm } from "./form";

export default function AudioTestPage() {
  return (
    <Container>
      <AppBreadcrumb>
        <HomeLinkBreadcrumb />
        <BreadcrumbItem>
          <BreadcrumbPage>Audio Test</BreadcrumbPage>
        </BreadcrumbItem>
      </AppBreadcrumb>

      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>Audio Generator</ContainerTitle>
          <ContainerDescription>
            Test AI-generated audio for words and sentences
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <AudioTestForm />
      </ContainerBody>
    </Container>
  );
}
