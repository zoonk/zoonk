import {
  AdminDetailBody,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { ReviewFlagNotice } from "@/components/review-flag-notice";
import { getItem } from "@/data/items/get-item";
import { ITEM_FORMAT_LABELS, getItemLabel } from "@/lib/item-label";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ItemAnswers } from "./item-answers";
import { ItemExplanations } from "./item-explanations";
import { ItemOverview } from "./item-overview";

export async function generateMetadata({ params }: PageProps<"/items/[id]">): Promise<Metadata> {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const record = await getItem(id);

  if (!record) {
    notFound();
  }

  return { title: getItemLabel(record) };
}

const ITEM_PARENTS = [{ href: "/items", label: "Items" }];

export default function ItemDetailPage({ params }: PageProps<"/items/[id]">) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<ItemDetailSkeleton />}>
        <ItemDetailContent params={params} />
      </Suspense>
    </AdminDetailPage>
  );
}

async function ItemDetailContent({ params }: Pick<PageProps<"/items/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const item = await getItem(id);

  if (!item) {
    notFound();
  }

  return (
    <>
      <AdminDetailHeader
        facts={[ITEM_FORMAT_LABELS[item.format], item.language.toUpperCase()]}
        parents={ITEM_PARENTS}
        title={getItemLabel(item)}
      />

      <AdminDetailBody>
        <Suspense fallback={null}>
          <ReviewFlagNotice target={{ itemId: item.id }} />
        </Suspense>

        <ItemOverview item={item} />

        <Suspense fallback={<AdminSectionSkeleton description />}>
          <ItemAnswers itemId={item.id} />
        </Suspense>

        <Suspense fallback={<AdminSectionSkeleton />}>
          <ItemExplanations itemId={item.id} />
        </Suspense>
      </AdminDetailBody>
    </>
  );
}

function ItemDetailSkeleton() {
  return (
    <>
      <AdminDetailHeaderSkeleton parents={ITEM_PARENTS} />

      <AdminDetailBody>
        <AdminSectionSkeleton rows={8} />
        <AdminSectionSkeleton />
      </AdminDetailBody>
    </>
  );
}
