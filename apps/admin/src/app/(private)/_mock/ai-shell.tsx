import { AdminNotice } from "@/components/admin-notice";
import { AdminPage, AdminPageBody, AdminPageHeader } from "@/components/admin-page";
import { AdminRecordTabs } from "@/components/admin-tabs";
import { MockLink } from "./parts";

const TABS = [
  { label: "Spend", value: "spend" },
  { label: "Failed or stuck (40)", value: "failed" },
  { label: "Plus learners", value: "plus" },
  { label: "Written by", value: "written" },
] as const;

export function AiMockShell({ children, current }: { children: React.ReactNode; current: string }) {
  return (
    <AdminPage>
      <AdminPageHeader title="AI" />
      <AdminPageBody className="gap-8">
        {current === "spend" ? (
          <AdminNotice title="40 AI runs failed or are stuck" tone="destructive">
            5 failed. 35 started over an hour ago and never finished. <MockLink>See them</MockLink>
          </AdminNotice>
        ) : null}
        <AdminRecordTabs current={current as "spend"} label="AI" path="/ai/mock" tabs={TABS} />
        {children}
      </AdminPageBody>
    </AdminPage>
  );
}
