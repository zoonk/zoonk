import { AdminQuerySelect } from "@/components/admin-query-select";
import { AdminSearch, AdminSearchSkeleton } from "@/components/admin-search";
import { ITEM_FORMAT_LABELS } from "@/lib/item-label";
import { LANGUAGE_FILTER_OPTIONS } from "@/lib/language-filter";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { Suspense } from "react";
import { ItemList, ItemListSkeleton } from "./item-list";

export const metadata: Metadata = { title: "Items" };

const FORMAT_OPTIONS = Object.entries(ITEM_FORMAT_LABELS).map(([value, label]) => ({
  label,
  value,
}));

/** Practice and exam questions, with how learners answer them and how they vote. */
export default function ItemsPage({ searchParams }: PageProps<"/items">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Items</ContainerTitle>
          <ContainerDescription>
            Review practice questions with their accuracy, votes and provenance.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<ItemFiltersSkeleton />}>
          <div className="flex flex-col gap-3">
            <AdminSearch placeholder="Search items by skill name..." />
            <div className="flex flex-wrap gap-3">
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
            </div>
          </div>
        </Suspense>

        <Suspense fallback={<ItemListSkeleton />}>
          <ItemList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

function ItemFiltersSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <AdminSearchSkeleton />
      <div className="flex gap-3">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-36" />
      </div>
    </div>
  );
}
