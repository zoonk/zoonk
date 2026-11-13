import { AdminPage, AdminPageBody, AdminPageHeader } from "@/components/admin-page";
import { type Metadata } from "next";
import { Suspense } from "react";
import { ReviewFlagList, ReviewFlagListSkeleton } from "./review-flag-list";

export const metadata: Metadata = { title: "Source changes" };

export default function ReviewFlagsPage() {
  return (
    <AdminPage>
      <AdminPageHeader title="Source changes">
        Content that cites a source that changed. Rewrite what&apos;s now wrong, dismiss what&apos;s
        still right.
      </AdminPageHeader>

      <AdminPageBody>
        <Suspense fallback={<ReviewFlagListSkeleton />}>
          <ReviewFlagList />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
