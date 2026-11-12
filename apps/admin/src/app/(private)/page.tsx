import { AdminPage, AdminPageBody, AdminPageHeader } from "@/components/admin-page";
import { AdminSection } from "@/components/admin-section";
import { type Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { HomeAttention, HomeAttentionSkeleton } from "./home-attention";
import { HomeWeek, HomeWeekSkeleton } from "./home-week";

export const metadata: Metadata = { title: "Zoonk Admin" };

export default async function Home() {
  // Review pack only: the Home decision's second option, switched on by a cookie.
  const numbersFirst = (await cookies()).get("adm-home")?.value === "numbers";

  const attention = (
    <AdminSection title="Needs attention">
      <Suspense fallback={<HomeAttentionSkeleton />}>
        <HomeAttention />
      </Suspense>
    </AdminSection>
  );

  const week = (
    <AdminSection description="Compared with the 7 days before" title="Last 7 days">
      <Suspense fallback={<HomeWeekSkeleton />}>
        <HomeWeek />
      </Suspense>
    </AdminSection>
  );

  return (
    <AdminPage>
      <AdminPageHeader title="Home" />

      <AdminPageBody className="gap-10">
        {numbersFirst ? week : attention}
        {numbersFirst ? attention : week}
      </AdminPageBody>
    </AdminPage>
  );
}
