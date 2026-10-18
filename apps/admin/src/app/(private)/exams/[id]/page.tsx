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
import { ExamEditionHistory } from "./exam-edition-history";
import { ExamOverview } from "./exam-overview";

export const metadata: Metadata = { title: "Exam" };

export default function ExamDetailPage({ params }: PageProps<"/exams/[id]">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <AdminBreadcrumb current="Exam" parents={[{ href: "/exams", label: "Exams" }]} />
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="gap-8">
        <Suspense fallback={<ExamDetailSkeleton />}>
          <ExamDetailContent params={params} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

async function ExamDetailContent({ params }: Pick<PageProps<"/exams/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  return (
    <>
      <Suspense fallback={<AdminSectionSkeleton />}>
        <ExamOverview examBlueprintId={id} />
      </Suspense>

      <Suspense fallback={<AdminSectionSkeleton />}>
        <ExamEditionHistory examBlueprintId={id} />
      </Suspense>
    </>
  );
}

function ExamDetailSkeleton() {
  return (
    <>
      <AdminSectionSkeleton />
      <AdminSectionSkeleton />
    </>
  );
}
