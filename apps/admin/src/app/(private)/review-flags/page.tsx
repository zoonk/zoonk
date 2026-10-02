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
import { ReviewFlagList, ReviewFlagListSkeleton } from "./review-flag-list";

export const metadata: Metadata = { title: "Needs review" };

/** Content built on a source that changed after it was written, until it's rewritten or dismissed. */
export default function ReviewFlagsPage() {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Needs review</ContainerTitle>
          <ContainerDescription>
            Lessons and questions built on a source that changed. The daily sweep rewrites lessons
            and law drills from the new text; dismiss what is still right.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<ReviewFlagListSkeleton />}>
          <ReviewFlagList />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
