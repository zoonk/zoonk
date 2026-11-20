import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { AdminRecordTabs, readAdminTab } from "@/components/admin-tabs";
import { ReviewFlagNotice } from "@/components/review-flag-notice";
import { getItem } from "@/data/items/get-item";
import { ITEM_FORMAT_LABELS, getItemLabel } from "@/lib/item-label";
import { languageName } from "@/lib/language-filter";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ItemAnswers } from "./item-answers";
import { ItemExplanations } from "./item-explanations";
import { ItemAbout, ItemDetails, ItemQuestion, ItemWrittenBy } from "./item-overview";

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

const ITEM_PARENTS = [{ href: "/items", label: "Practice questions" }];

const ITEM_TABS = [
  { label: "Question", value: "question" },
  { label: "Details", value: "details" },
  { label: "Written by", value: "written" },
] as const;

export default function ItemDetailPage({ params, searchParams }: PageProps<"/items/[id]">) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<ItemDetailSkeleton />}>
        <ItemDetailContent params={params} searchParams={searchParams} />
      </Suspense>
    </AdminDetailPage>
  );
}

async function ItemDetailContent({ params, searchParams }: PageProps<"/items/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  if (!isUuid(id)) {
    notFound();
  }

  const item = await getItem(id);

  if (!item) {
    notFound();
  }

  const tab = readAdminTab({ tabs: ITEM_TABS, value: query.tab });

  return (
    <>
      <AdminDetailHeader
        facts={[ITEM_FORMAT_LABELS[item.format], languageName(item.language)]}
        parents={ITEM_PARENTS}
        title={getItemLabel(item)}
      />

      <AdminDetailBody>
        <Suspense fallback={null}>
          <ReviewFlagNotice target={{ itemId: item.id }} />
        </Suspense>

        <AdminRecordTabs
          current={tab}
          label="Practice question"
          path={`/items/${item.id}`}
          tabs={ITEM_TABS}
        />

        {tab === "question" ? (
          <AdminDetailColumns
            aside={
              <>
                <Suspense fallback={<AdminSectionSkeleton rows={2} />}>
                  <ItemAnswers itemId={item.id} />
                </Suspense>
                <ItemAbout item={item} />
              </>
            }
          >
            <ItemQuestion item={item} />
          </AdminDetailColumns>
        ) : null}

        {tab === "details" ? (
          <>
            <ItemDetails item={item} />
            <Suspense fallback={<AdminSectionSkeleton />}>
              <ItemExplanations itemId={item.id} />
            </Suspense>
          </>
        ) : null}

        {tab === "written" ? <ItemWrittenBy item={item} /> : null}
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
