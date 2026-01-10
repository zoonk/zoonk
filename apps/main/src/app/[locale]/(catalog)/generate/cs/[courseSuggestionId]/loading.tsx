import {
  Container,
  ContainerBody,
  ContainerHeader,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";

export default function GenerateCourseLoading() {
  return (
    <Container variant="narrow">
      <ContainerHeader>
        <Skeleton className="h-7 w-48" />
      </ContainerHeader>

      <ContainerBody className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-full" />
        </div>

        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div className="flex items-center gap-3" key={i}>
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      </ContainerBody>
    </Container>
  );
}
