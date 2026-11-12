import { AppBreadcrumb, HomeLinkBreadcrumb } from "@/components/breadcrumb";
import {
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@zoonk/ui/components/breadcrumb";
import {
  ContainerBody,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { AudioTestForm } from "./form";

export default function AudioTestPage() {
  return (
    <main className="flex flex-col gap-4">
      <AppBreadcrumb>
        <HomeLinkBreadcrumb />
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Audio test</BreadcrumbPage>
        </BreadcrumbItem>
      </AppBreadcrumb>

      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>Audio test</ContainerTitle>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <AudioTestForm />
      </ContainerBody>
    </main>
  );
}
