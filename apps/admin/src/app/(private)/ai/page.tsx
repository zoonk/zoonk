import { AdminNotice } from "@/components/admin-notice";
import { AdminPage, AdminPageBody, AdminPageHeader } from "@/components/admin-page";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { AdminRecordTabs, readAdminTab } from "@/components/admin-tabs";
import { STUCK_RUNNING_MINUTES, countGenerationFailures } from "@/data/ai/get-generation-failures";
import { formatCount } from "@/lib/format";
import { readQueryParam } from "@/lib/query-param";
import { sumOf } from "@zoonk/utils/number";
import { type Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { parseAiPeriodDays } from "./_utils/ai-period";
import { AI_TABS } from "./_utils/ai-tabs";
import { AiPlusLearnersSection } from "./ai-plus-learners-section";
import { AiSpendSection, parseSpendBy } from "./ai-spend-section";
import { GenerationFailuresSection } from "./generation-failures-section";
import { ProvenanceSection } from "./provenance-section";

export const metadata: Metadata = { title: "AI" };

const MINUTES_PER_HOUR = 60;

async function AiTabs({ searchParams }: { searchParams: PageProps<"/ai">["searchParams"] }) {
  const [params, failures] = await Promise.all([searchParams, countGenerationFailures()]);
  const tab = readAdminTab({ tabs: AI_TABS, value: params.tab });
  const days = parseAiPeriodDays(params.days);
  const failed = sumOf(failures.map((row) => row.failed));
  const stuck = sumOf(failures.map((row) => row.stuck));

  return (
    <>
      {tab === "spend" && failed + stuck > 0 ? (
        <AdminNotice
          title={`${formatCount(failed + stuck, "AI run")} failed or got stuck`}
          tone="destructive"
        >
          {failed.toLocaleString("en")} failed. {stuck.toLocaleString("en")} started over{" "}
          {formatCount(STUCK_RUNNING_MINUTES / MINUTES_PER_HOUR, "hour")} ago and never finished.{" "}
          <Link href="/ai?tab=failed" prefetch>
            See them
          </Link>
        </AdminNotice>
      ) : null}

      <AdminRecordTabs
        current={tab}
        label="AI"
        path="/ai"
        tabs={AI_TABS.map((item) =>
          item.value === "failed" ? { ...item, count: failed + stuck } : item,
        )}
      />

      <Suspense fallback={<AdminSectionSkeleton rows={8} />} key={tab}>
        {tab === "spend" ? (
          <AiSpendSection
            by={parseSpendBy(params.by)}
            days={days}
            showAll={readQueryParam(params.all) === "1"}
          />
        ) : null}
        {tab === "failed" ? <GenerationFailuresSection kind={readQueryParam(params.kind)} /> : null}
        {tab === "plus" ? <AiPlusLearnersSection /> : null}
        {tab === "written" ? <ProvenanceSection days={days} /> : null}
      </Suspense>
    </>
  );
}

export default function AiPage({ searchParams }: PageProps<"/ai">) {
  return (
    <AdminPage>
      <AdminPageHeader title="AI" />
      <AdminPageBody className="gap-10">
        <Suspense fallback={<AdminSectionSkeleton rows={8} />}>
          <AiTabs searchParams={searchParams} />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
