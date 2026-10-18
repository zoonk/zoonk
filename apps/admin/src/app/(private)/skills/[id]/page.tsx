import { AdminBreadcrumb } from "@/components/admin-breadcrumb";
import { AdminSectionSkeleton } from "@/components/admin-section";
import {
  Container,
  ContainerBody,
  ContainerHeader,
  ContainerHeaderGroup,
} from "@zoonk/ui/components/container";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SkillGraph } from "./skill-graph";
import { SkillLearners } from "./skill-learners";
import { SkillOverview } from "./skill-overview";
import { SkillUsage } from "./skill-usage";

export const metadata: Metadata = { title: "Skill" };

export default function SkillDetailPage({ params }: PageProps<"/skills/[id]">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <AdminBreadcrumb current="Skill" parents={[{ href: "/skills", label: "Skills" }]} />
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="gap-8">
        <Suspense fallback={<SkillDetailSkeleton />}>
          <SkillDetailContent params={params} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

/** Each section loads on its own, so a large graph never holds back the skill's fields. */
async function SkillDetailContent({ params }: Pick<PageProps<"/skills/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  return (
    <>
      <Suspense fallback={<AdminSectionSkeleton />}>
        <SkillOverview skillId={id} />
      </Suspense>

      <Suspense fallback={<AdminSectionSkeleton />}>
        <SkillGraph skillId={id} />
      </Suspense>

      <Suspense fallback={<AdminSectionSkeleton />}>
        <SkillLearners skillId={id} />
      </Suspense>

      <Suspense fallback={<AdminSectionSkeleton />}>
        <SkillUsage skillId={id} />
      </Suspense>
    </>
  );
}

function SkillDetailSkeleton() {
  return (
    <>
      <AdminSectionSkeleton />
      <AdminSectionSkeleton />
      <AdminSectionSkeleton />
    </>
  );
}
