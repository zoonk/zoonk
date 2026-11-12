import { AdminPage, AdminPageBody, AdminPageHeader } from "@/components/admin-page";
import { AdminSection } from "@/components/admin-section";
import { type Metadata } from "next";
import { Suspense } from "react";
import { HomeAttention, HomeAttentionSkeleton } from "./home-attention";
import { HomeWeek, HomeWeekSkeleton } from "./home-week";

export const metadata: Metadata = { title: "Zoonk Admin" };

export default function Home() {
  return (
    <AdminPage>
      <AdminPageHeader title="Home" />

      <AdminPageBody className="gap-10">
        <AdminSection title="Needs attention">
          <Suspense fallback={<HomeAttentionSkeleton />}>
            <HomeAttention />
          </Suspense>
        </AdminSection>

        <AdminSection description="Compared with the 7 days before" title="Last 7 days">
          <Suspense fallback={<HomeWeekSkeleton />}>
            <HomeWeek />
          </Suspense>
        </AdminSection>
      </AdminPageBody>
    </AdminPage>
  );
}
