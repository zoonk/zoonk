import dump from "@/app/(private)/_mock/data/source.json";
import { type Dump, Facts, MockRows, field, readView } from "@/app/(private)/_mock/kit";
import { MockMenu } from "@/app/(private)/_mock/menu";
import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { AdminRecordTabs } from "@/components/admin-tabs";
import { Button } from "@zoonk/ui/components/button";
import { CircleStopIcon, RefreshCwIcon } from "lucide-react";
import { MockLink } from "../../_mock/parts";

const source = dump as Dump;

const TABS = [
  { label: "Overview", value: "overview" },
  { label: "Text", value: "text" },
  { label: "Details", value: "details" },
] as const;

const NONE = <span className="text-faint">None</span>;
const marker = "Extracted text (1,237 characters)";
const text = source.text
  .slice(source.text.indexOf(marker) + marker.length, source.text.indexOf("Change notices"))
  .trim();

const ACTIONS = [
  {
    confirm: {
      confirmLabel: "Stop checking",
      description:
        "Zoonk stops looking for changes to it. Checks start again when a learner's goal needs it.",
      title: "Stop checking Edital do Enem 2026?",
    },
    icon: <CircleStopIcon aria-hidden="true" />,
    label: "Stop checking",
  },
];

export default async function SourceMockPage({ searchParams }: PageProps<"/sources/mock-one">) {
  const tab = readView((await searchParams).tab) || "overview";

  return (
    <AdminDetailPage>
      <AdminDetailHeader
        actions={
          <Button size="sm" variant="outline">
            <RefreshCwIcon aria-hidden="true" />
            Check now
          </Button>
        }
        facts={["Checked Nov 12, 2026", "Inep", "Official", "Portuguese"]}
        menu={<MockMenu actions={ACTIONS} label="Source actions" />}
        parents={[{ href: "/sources", label: "Sources" }]}
        title="Edital do Enem 2026"
      />

      <AdminDetailBody>
        <AdminRecordTabs
          current={tab as "overview"}
          label="Source"
          path="/sources/mock-one"
          tabs={TABS}
        />

        {tab === "text" ? (
          <AdminSection title="What Zoonk read from it (1,237 characters)">
            <p className="max-w-column text-sm leading-6 whitespace-pre-line">{text}</p>
          </AdminSection>
        ) : null}

        {tab === "details" ? (
          <AdminSection title="Details">
            <Facts
              rows={[
                ["MIME type", field(source, "MIME type")],
                ["Content hash", field(source, "Content hash")],
                ["Reuse policy", NONE],
                ["Structure", NONE],
                ["Learners", field(source, "Learners")],
              ]}
            />
          </AdminSection>
        ) : null}

        {tab === "overview" ? (
          <AdminDetailColumns
            aside={
              <AdminSection title="Checking">
                <Facts
                  rows={[
                    ["Last checked", field(source, "Fetched")],
                    ["Good until", field(source, "Valid until")],
                    ["Next check", "—"],
                  ]}
                />
              </AdminSection>
            }
          >
            <AdminSection title="Link">
              <MockLink>{field(source, "URL")}</MockLink>
            </AdminSection>

            <AdminSection title="Cited by 2 exams">
              <MockRows
                columns={[{ label: "Exam" }, { label: "Country" }, { label: "Language" }]}
                rows={[
                  [<MockLink key="pt">ENEM</MockLink>, "Brazil", "Portuguese"],
                  [<MockLink key="en">ENEM</MockLink>, "Brazil", "English"],
                ]}
              />
              <AdminSectionEmpty>No practice question cites this source.</AdminSectionEmpty>
            </AdminSection>

            <AdminSection title="What changed">
              <AdminSectionEmpty>No fetch has changed this source yet.</AdminSectionEmpty>
            </AdminSection>
          </AdminDetailColumns>
        ) : null}
      </AdminDetailBody>
    </AdminDetailPage>
  );
}
