import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from "@zoonk/ui/components/breadcrumb";
import Link from "next/link";

function AppBreadcrumb({ children, ...props }: React.ComponentProps<"nav">) {
  return (
    <Breadcrumb {...props}>
      <BreadcrumbList>{children}</BreadcrumbList>
    </Breadcrumb>
  );
}

function HomePageBreadcrumb() {
  return (
    <BreadcrumbItem>
      <BreadcrumbPage>Home</BreadcrumbPage>
    </BreadcrumbItem>
  );
}

function HomeLinkBreadcrumb() {
  return (
    <BreadcrumbItem>
      <BreadcrumbLink asChild>
        <Link href="/">Home</Link>
      </BreadcrumbLink>
    </BreadcrumbItem>
  );
}

function TaskPageBreadcrumb({ taskName }: { taskName: string }) {
  return (
    <BreadcrumbItem>
      <BreadcrumbPage>{taskName}</BreadcrumbPage>
    </BreadcrumbItem>
  );
}

function TaskLinkBreadcrumb({
  taskId,
  taskName,
}: {
  taskId: string;
  taskName: string;
}) {
  return (
    <BreadcrumbItem>
      <BreadcrumbLink asChild>
        <Link href={`/tasks/${taskId}`}>{taskName}</Link>
      </BreadcrumbLink>
    </BreadcrumbItem>
  );
}

function ModelPageBreadcrumb({ modelName }: { modelName: string }) {
  return (
    <BreadcrumbItem>
      <BreadcrumbPage>{modelName}</BreadcrumbPage>
    </BreadcrumbItem>
  );
}

export {
  AppBreadcrumb,
  HomePageBreadcrumb,
  HomeLinkBreadcrumb,
  TaskPageBreadcrumb,
  TaskLinkBreadcrumb,
  ModelPageBreadcrumb,
};
