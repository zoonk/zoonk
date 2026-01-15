import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from "@zoonk/ui/components/breadcrumb";
import { cn } from "@zoonk/ui/lib/utils";
import Link from "next/link";

function AppBreadcrumb({
  children,
  className,
  ...props
}: React.ComponentProps<"nav">) {
  return (
    <Breadcrumb className={cn("px-4 pt-4", className)} {...props}>
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
      <BreadcrumbLink render={<Link href="/" />}>Home</BreadcrumbLink>
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
      <BreadcrumbLink render={<Link href={`/tasks/${taskId}`} />}>
        {taskName}
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

function BattlesPageBreadcrumb() {
  return (
    <BreadcrumbItem>
      <BreadcrumbPage>Battles</BreadcrumbPage>
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
  BattlesPageBreadcrumb,
};
