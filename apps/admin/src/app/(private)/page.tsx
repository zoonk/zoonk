import { AdminPage, AdminPageBody, AdminPageHeader } from "@/components/admin-page";
import { AdminSection } from "@/components/admin-section";
import { type Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { HomeAttention, HomeAttentionSkeleton } from "./home-attention";
import { HomeWeek, HomeWeekSkeleton } from "./home-week";

export const metadata: Metadata = { title: "Zoonk Admin" };

function AttentionSection({ loading = false }: { loading?: boolean }) {
  return (
    <AdminSection title="Needs attention">
      {loading ? <HomeAttentionSkeleton /> : <HomeAttention />}
    </AdminSection>
  );
}

export default async function Home() {
  // Review pack only: the Home decision's second option, switched on by a cookie.
  const numbersFirst = (await cookies()).get("adm-home")?.value === "numbers";

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
        {numbersFirst ? week : null}

        {/* What follows the list arrives with it: how many rows it has isn't known before, so
            anything drawn under its skeleton would jump when it loads. */}
        <Suspense fallback={<AttentionSection loading />}>
          <AttentionSection />
          {numbersFirst ? null : week}
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
