import {
  Container,
  ContainerBody,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";

export async function GenerateChapterContent() {
  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          {/* biome-ignore lint/nursery/noJsxLiterals: placeholder page */}
          <ContainerTitle>Generate Chapter</ContainerTitle>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-muted-foreground">
          {/* biome-ignore lint/nursery/noJsxLiterals: placeholder page */}
          Coming soon
        </div>
      </ContainerBody>
    </Container>
  );
}

export function GenerateChapterFallback() {
  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <Skeleton className="h-8 w-48" />
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Skeleton className="h-64 w-full rounded-xl" />
      </ContainerBody>
    </Container>
  );
}
