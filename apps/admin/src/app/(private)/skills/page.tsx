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
import { SkillFilters, SkillFiltersSkeleton } from "./skill-filters";
import { SkillList, SkillListSkeleton } from "./skill-list";

export const metadata: Metadata = { title: "Skills" };

/** Library skills: the unit of mastery, review and study cards. */
export default function SkillsPage({ searchParams }: PageProps<"/skills">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Skills</ContainerTitle>
          <ContainerDescription>
            Browse Library skills, where they are taught and how many learners practice them.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<SkillFiltersSkeleton />}>
          <SkillFilters searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<SkillListSkeleton />}>
          <SkillList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
