import { AdminSearch, AdminSearchSkeleton } from "@/components/admin-search";
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
import { QuestionList, QuestionListSkeleton } from "./question-list";

export const metadata: Metadata = { title: "Questions" };

export default function QuestionsPage({ searchParams }: PageProps<"/questions">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Questions</ContainerTitle>
          <ContainerDescription>
            Review what learners ask and the answers they receive.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<AdminSearchSkeleton />}>
          <AdminSearch placeholder="Search questions, answers, lessons, courses, or users..." />
        </Suspense>

        <Suspense fallback={<QuestionListSkeleton />}>
          <QuestionList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
