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
import { FeedbackFilters, FeedbackFiltersSkeleton } from "./feedback-filters";
import { FeedbackList, FeedbackListSkeleton } from "./feedback-list";
import { FeedbackSummary, FeedbackSummarySkeleton } from "./feedback-summary";
import { FeedbackViewsNav } from "./feedback-views-nav";

export const metadata: Metadata = { title: "Feedback" };

/**
 * Learners' votes on AI content, newest first. Downvotes and their reasons show which screens to
 * regenerate first.
 */
export default function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Feedback</ContainerTitle>
          <ContainerDescription>
            Votes on AI content. Downvotes and their reasons show what to regenerate first.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <FeedbackViewsNav current="/feedback" />

        <Suspense fallback={<FeedbackFiltersSkeleton />}>
          <FeedbackFilters searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<FeedbackSummarySkeleton />}>
          <FeedbackSummary searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<FeedbackListSkeleton />}>
          <FeedbackList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
