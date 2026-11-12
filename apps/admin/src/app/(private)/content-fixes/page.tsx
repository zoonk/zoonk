import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { Suspense } from "react";
import { ContentFixList, ContentFixListSkeleton } from "./content-fix-list";

export const metadata: Metadata = { title: "Content fixes" };

export default function ContentFixesPage() {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Content fixes</ContainerTitle>
          <ContainerDescription>
            Fixes to shared course content that staff proposed with pnpm zoonk staff fixes propose.
            A fix changes nothing until a staff person reviews it here and approves it with a
            passkey.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="gap-8">
        <Suspense fallback={<ContentFixListSkeleton />}>
          <ContentFixList />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
