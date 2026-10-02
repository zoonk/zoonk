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
import { FeedbackDetail } from "./feedback-detail";

export const metadata: Metadata = { title: "Vote" };

export default function FeedbackDetailPage({ params }: PageProps<"/feedback/[id]">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <AdminBreadcrumb current="Vote" parents={[{ href: "/feedback", label: "Feedback" }]} />
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="mx-auto w-full max-w-4xl gap-8">
        <Suspense fallback={<FeedbackDetailSkeleton />}>
          <FeedbackDetailContent params={params} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

async function FeedbackDetailContent({ params }: Pick<PageProps<"/feedback/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  return <FeedbackDetail id={id} />;
}

function FeedbackDetailSkeleton() {
  return (
    <>
      <AdminSectionSkeleton />
      <AdminSectionSkeleton />
      <AdminSectionSkeleton />
    </>
  );
}
