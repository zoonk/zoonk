import {
  BreadcrumbItem,
  BreadcrumbPage,
} from "@zoonk/ui/components/breadcrumb";
import {
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { AppBreadcrumb, HomeLinkBreadcrumb } from "@/patterns/breadcrumb";
import { ImageTestForm } from "./form";

export default function ImageTestPage() {
  return (
    <main className="flex flex-col gap-4">
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

      <ImageTestForm />
    </main>
  );
}
