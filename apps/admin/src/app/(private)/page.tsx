import { AdminPage, AdminPageBody, AdminPageHeader } from "@/components/admin-page";
import { AdminSection } from "@/components/admin-section";
import { type Metadata } from "next";
import { Suspense } from "react";
import { loadAttention, loadWeek } from "./home-data";
import { AttentionTiles, AttentionTilesSkeleton, WeekTiles, WeekTilesSkeleton } from "./home-parts";

export const metadata: Metadata = { title: "Zoonk Admin" };

async function HomeAttention() {
  return <AttentionTiles items={await loadAttention()} />;
}

async function HomeWeek() {
  "use cache: private";

  // oxlint-disable-next-line react/purity -- A cached Server Component reads the time once per cache entry and never re-renders on the client.
  return <WeekTiles week={await loadWeek(new Date())} />;
}

function Week() {
  return (
    <AdminSection
      description="Compared with the 7 days before, the gray part of each line"
      title="Last 7 days"
    >
      <Suspense fallback={<WeekTilesSkeleton />}>
        <HomeWeek />
      </Suspense>
    </AdminSection>
  );
}

export default function Home() {
  return (
    <AdminPage>
      <AdminPageHeader title="Home" />

      <AdminPageBody className="gap-10">
        {/* What follows the tiles arrives with them: how many there are isn't known before, so
            anything drawn under their skeleton would jump when they load. */}
        <Suspense
          fallback={
            <AdminSection title="Needs attention">
              <AttentionTilesSkeleton />
            </AdminSection>
          }
        >
          <AdminSection title="Needs attention">
            <HomeAttention />
          </AdminSection>
          <Week />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
