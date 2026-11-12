import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSection } from "@/components/admin-section";
import { AdminTabs } from "@/components/admin-tabs";
import { DetailField, DetailFields } from "@/components/detail-field";
import { Button } from "@zoonk/ui/components/button";
import { EllipsisIcon, RefreshCwIcon } from "lucide-react";
import { MockLink } from "../../_mock/parts";

const TABS = [
  { label: "Overview", value: "overview" },
  { label: "Blueprint", value: "blueprint" },
  { label: "Skill graph", value: "graph" },
  { label: "Written by", value: "written" },
] as const;

export default function ExamMockPage() {
  return (
    <AdminDetailPage>
      <AdminDetailHeader
        actions={
          <Button size="lg" variant="outline">
            <RefreshCwIcon aria-hidden="true" />
            Check now
          </Button>
        }
        facts={["Checked Oct 9, 2026", "FGV", "1ª fase", "Brazil", "Portuguese"]}
        menu={
          <Button
            aria-label="Exam actions"
            className="size-11 shrink-0"
            size="icon"
            variant="outline"
          >
            <EllipsisIcon aria-hidden="true" />
          </Button>
        }
        parents={[{ href: "/exams", label: "Exams" }]}
        title="OAB Exame de Ordem Unificado"
      />

      <AdminDetailBody>
        <AdminTabs current="overview" label="Exam" path="/exams/mock" tabs={TABS} />

        <AdminDetailColumns
          aside={
            <>
              <AdminSection title="Checking">
                <DetailFields>
                  <DetailField label="Official notice">
                    <MockLink>Edital de Abertura do 48º EOU</MockLink>
                  </DetailField>
                  <DetailField label="Last checked">Oct 9, 2026</DetailField>
                  <DetailField label="Next check">Nov 13, 2026</DetailField>
                </DetailFields>
              </AdminSection>

              <AdminSection title="In use">
                <DetailFields>
                  <DetailField label="Goals">0</DetailField>
                  <DetailField label="Practice questions">
                    <MockLink>109</MockLink>
                  </DetailField>
                  <DetailField label="Skill graph">Not written yet</DetailField>
                </DetailFields>
              </AdminSection>
            </>
          }
        >
          <AdminSection title="This edition">
            <DetailFields>
              <DetailField label="Exam date">Jan 10, 2027</DetailField>
              <DetailField label="Registration ends">Oct 5, 2026</DetailField>
              <DetailField label="Good until">Jan 9, 2027</DetailField>
            </DetailFields>
          </AdminSection>

          <AdminSection title="What changed">
            <ul className="divide-y">
              <li className="flex flex-col gap-1 py-3 text-sm">
                <p className="max-w-2xl leading-6">
                  O edital do 48º Exame de Ordem mudou a data da prova objetiva e incluiu Direito
                  Digital no conteúdo programático.
                </p>
                <p className="text-muted-foreground text-xs">
                  Nov 11, 2026 · Exam date, Subjects · Learners with this goal were told
                </p>
              </li>
            </ul>
          </AdminSection>
        </AdminDetailColumns>
      </AdminDetailBody>
    </AdminDetailPage>
  );
}
