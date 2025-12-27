import {
  ContainerHeader,
  ContainerHeaderGroup,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";

export function CourseEditorSkeleton() {
  return (
    <ContainerHeader>
      <ContainerHeaderGroup className="flex-1 gap-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </ContainerHeaderGroup>
    </ContainerHeader>
  );
}
