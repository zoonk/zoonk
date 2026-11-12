import { AdminNotice } from "@/components/admin-notice";
import { AdminPage, AdminPageBody, AdminPageHeader } from "@/components/admin-page";
import { AdminTabs } from "@/components/admin-tabs";
import { MockLink } from "./parts";

const TABS = [
  { label: "Spend", value: "spend" },
  { label: "Failed runs (40)", value: "failed" },
  { label: "Plus learners", value: "plus" },
  { label: "Written by", value: "written" },
] as const;

export function AiMockShell({
  children,
  current,
  notice = false,
}: {
  children: React.ReactNode;
  current: (typeof TABS)[number]["value"];
  notice?: boolean;
}) {
  return (
    <AdminPage>
      <AdminPageHeader title="AI" />
      <AdminPageBody className="gap-8">
        {notice ? (
          <AdminNotice title="40 AI runs need a look" tone="destructive">
            5 failed and 35 have been running for over 1 hour. <MockLink>See failed runs</MockLink>
          </AdminNotice>
        ) : null}
        <AdminTabs current={current} label="AI" path="/ai/mock" tabs={TABS} />
        {children}
      </AdminPageBody>
    </AdminPage>
  );
}
