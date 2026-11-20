import { AdminPage, AdminPageBody, AdminPageHeader, AdminToolbar } from "@/components/admin-page";
import { AdminSearch, AdminSearchSkeleton } from "@/components/admin-search";
import { type Metadata } from "next";
import { Suspense } from "react";
import { UserList, UserListSkeleton } from "./user-list";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage({ searchParams }: PageProps<"/users">) {
  return (
    <AdminPage>
      <AdminPageHeader title="Users" />

      <AdminPageBody>
        <AdminToolbar>
          <Suspense fallback={<AdminSearchSkeleton />}>
            <AdminSearch placeholder="Search by name, username or email…" />
          </Suspense>
        </AdminToolbar>

        <Suspense fallback={<UserListSkeleton />}>
          <UserList searchParams={searchParams} />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
