import { AdminPage, AdminPageBody, AdminPageHeader } from "@/components/admin-page";
import { type Metadata } from "next";
import { Suspense } from "react";
import { CliLoginList, CliLoginListSkeleton } from "./cli-login-list";

export const metadata: Metadata = { title: "CLI logins" };

export default function CliLoginsPage() {
  return (
    <AdminPage>
      <AdminPageHeader title="CLI logins">Staff logged in to the Zoonk CLI.</AdminPageHeader>

      <AdminPageBody>
        <Suspense fallback={<CliLoginListSkeleton />}>
          <CliLoginList />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
