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
import { ExamList, ExamListSkeleton } from "./exam-list";

export const metadata: Metadata = { title: "Exams" };

/** Exam blueprints with their current edition and the dates the freshness checks watch. */
export default function ExamsPage({ searchParams }: PageProps<"/exams">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Exams</ContainerTitle>
          <ContainerDescription>
            Exam blueprints, their current edition and how many goals and items depend on them.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<ExamListSkeleton />}>
          <ExamList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
