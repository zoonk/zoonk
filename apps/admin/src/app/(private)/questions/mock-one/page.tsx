import dump from "@/app/(private)/_mock/data/question.json";
import { type Dump, Facts, field, readView } from "@/app/(private)/_mock/kit";
import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { AdminTabs } from "@/components/admin-tabs";
import { MockLink } from "../../_mock/parts";

const question = dump as Dump;

const TABS = [
  { label: "Answer", value: "answer" },
  { label: "Written by", value: "written" },
] as const;

const lines = question.text.split("\n").map((line) => line.trim());
const answer = lines.slice(lines.indexOf("Answer") + 1, lines.indexOf("Details")).filter(Boolean);
const title = lines.find(Boolean) === "Questions" ? (lines.filter(Boolean)[1] ?? "") : "";

export default async function BuddyQuestionMockPage({
  searchParams,
}: PageProps<"/questions/mock-one">) {
  const tab = readView((await searchParams).tab) || "answer";

  return (
    <AdminDetailPage>
      <AdminDetailHeader
        facts={["Will", "Asked Oct 26, 2026"]}
        parents={[{ href: "/questions", label: "Buddy questions" }]}
        title={title}
        titleClassName="text-xl leading-7 max-w-3xl"
      />

      <AdminDetailBody>
        <AdminTabs current={tab as "answer"} label="Buddy question" path="/questions/mock-one" tabs={TABS} />

        {tab === "written" ? (
          <AdminSection title="Written by">
            <Facts
              rows={["Model", "Provider", "Input tokens", "Output tokens", "Cost", "Finish reason", "Updated"].map(
                (label) => [label, field(question, label)],
              )}
            />
          </AdminSection>
        ) : (
          <AdminDetailColumns
            aside={
              <AdminSection title="Asked in">
                <Facts
                  rows={[
                    ["Lesson", <MockLink key="lesson">{field(question, "Lesson")}</MockLink>],
                    ["Screen", "3"],
                    ["Chapter", field(question, "Chapter")],
                    ["Course", <MockLink key="course">{field(question, "Course")}</MockLink>],
                    ["Asked by", <MockLink key="who">Will</MockLink>],
                  ]}
                />
              </AdminSection>
            }
          >
            <AdminSection title="The buddy answered">
              <div className="flex max-w-2xl flex-col gap-3 text-sm leading-6">
                {answer.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </AdminSection>
          </AdminDetailColumns>
        )}
      </AdminDetailBody>
    </AdminDetailPage>
  );
}
