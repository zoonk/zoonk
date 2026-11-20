import { AdminPage, AdminPageBody, AdminPageHeader } from "@/components/admin-page";
import { type Metadata } from "next";
import { Suspense } from "react";
import { AccountDeletionList, AccountDeletionListSkeleton } from "./account-deletion-list";

export const metadata: Metadata = { title: "Account deletions" };

/** An account's analytics stay in PostHog until an admin deletes that person by hand. */
export default function AccountDeletionsPage() {
  return (
    <AdminPage>
      <AdminPageHeader title="Account deletions">
        Deleted accounts whose analytics are still in PostHog. For each id: in PostHog, open
        Persons, search for the id, and delete the person with their events and recordings. Then
        mark it removed.
      </AdminPageHeader>

      <AdminPageBody>
        <Suspense fallback={<AccountDeletionListSkeleton />}>
          <AccountDeletionList />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
