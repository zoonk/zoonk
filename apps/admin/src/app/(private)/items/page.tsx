import { AdminPage, AdminPageBody, AdminPageHeader, AdminToolbar } from "@/components/admin-page";
import { AdminQuerySelect } from "@/components/admin-query-select";
import { AdminSearch, AdminSearchSkeleton } from "@/components/admin-search";
import { ITEM_FORMAT_LABELS } from "@/lib/item-label";
import { LANGUAGE_FILTER_OPTIONS } from "@/lib/language-filter";
import { type Metadata } from "next";
import { Suspense } from "react";
import { ItemList, ItemListSkeleton } from "./item-list";

export const metadata: Metadata = { title: "Practice questions" };

const FORMAT_OPTIONS = Object.entries(ITEM_FORMAT_LABELS).map(([value, label]) => ({
  label,
  value,
}));

export default function ItemsPage({ searchParams }: PageProps<"/items">) {
  return (
    <AdminPage>
      <AdminPageHeader title="Practice questions" />

      <AdminPageBody>
        <AdminToolbar>
          <Suspense fallback={<AdminSearchSkeleton />}>
            <AdminSearch placeholder="Search by question or skill…" />
            <AdminQuerySelect
              allLabel="All formats"
              label="Format"
              name="format"
              options={FORMAT_OPTIONS}
            />
            <AdminQuerySelect
              allLabel="All languages"
              label="Language"
              name="language"
              options={LANGUAGE_FILTER_OPTIONS}
            />
          </Suspense>
        </AdminToolbar>

        <Suspense fallback={<ItemListSkeleton />}>
          <ItemList searchParams={searchParams} />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
