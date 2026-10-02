import { AdminBreadcrumb } from "@/components/admin-breadcrumb";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { ReviewFlagNotice } from "@/components/review-flag-notice";
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
import { ItemAnswers } from "./item-answers";
import { ItemExplanations } from "./item-explanations";
import { ItemOverview } from "./item-overview";

export const metadata: Metadata = { title: "Item" };

export default function ItemDetailPage({ params }: PageProps<"/items/[id]">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <AdminBreadcrumb current="Item" parents={[{ href: "/items", label: "Items" }]} />
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="gap-8">
        <Suspense fallback={<ItemDetailSkeleton />}>
          <ItemDetailContent params={params} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

/** Answer numbers load beside the item's content, so neither waits on the other. */
async function ItemDetailContent({ params }: Pick<PageProps<"/items/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  return (
    <>
      <Suspense fallback={null}>
        <ReviewFlagNotice target={{ itemId: id }} />
      </Suspense>

      <Suspense fallback={<AdminSectionSkeleton />}>
        <ItemOverview itemId={id} />
      </Suspense>

      <Suspense fallback={<AdminSectionSkeleton />}>
        <ItemAnswers itemId={id} />
      </Suspense>

      <Suspense fallback={<AdminSectionSkeleton />}>
        <ItemExplanations itemId={id} />
      </Suspense>
    </>
  );
}

function ItemDetailSkeleton() {
  return (
    <>
      <AdminSectionSkeleton />
      <AdminSectionSkeleton />
      <AdminSectionSkeleton />
    </>
  );
}
