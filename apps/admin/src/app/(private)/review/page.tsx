import { REVIEW_GROUPS } from "@/lib/review-utils";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { Suspense } from "react";
import { ReviewLanding } from "./review-landing";

export const metadata: Metadata = {
  title: "AI Content Review",
};

function ReviewLandingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {REVIEW_GROUPS.map(({ group }) => (
        <div key={group} className="flex flex-col gap-1">
          <Skeleton className="mb-1 h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>AI Content Review</ContainerTitle>
          <ContainerDescription>
            Review AI-generated content before it goes live.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<ReviewLandingSkeleton />}>
          <ReviewLanding />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
