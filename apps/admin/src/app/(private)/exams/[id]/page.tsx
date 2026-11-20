import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { AdminRecordTabs, readAdminTab } from "@/components/admin-tabs";
import { STAT_TILES_CLASS, StatTileSkeleton } from "@/components/stat-tile";
import { getExam } from "@/data/exams/get-exam";
import { countryName } from "@/lib/country-name";
import { languageName } from "@/lib/language-filter";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExamActions } from "./exam-actions";
import { ExamBlueprint } from "./exam-blueprint";
import { ExamEditionHistory } from "./exam-edition-history";
import {
  ExamChecking,
  ExamDetails,
  ExamEditionDates,
  ExamTotals,
  ExamWrittenBy,
} from "./exam-overview";
import { ExamSkillGraph } from "./exam-skill-graph";

export async function generateMetadata({ params }: PageProps<"/exams/[id]">): Promise<Metadata> {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const record = await getExam(id);

  if (!record) {
    notFound();
  }

  return { title: record.name };
}

const EXAM_PARENTS = [{ href: "/exams", label: "Exams" }];

const EXAM_TABS = [
  { label: "Overview", value: "overview" },
  { label: "Blueprint", value: "blueprint" },
  { label: "Skill graph", value: "graph" },
  { label: "Details", value: "details" },
] as const;

export default function ExamDetailPage({ params, searchParams }: PageProps<"/exams/[id]">) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<ExamDetailSkeleton />}>
        <ExamDetailContent params={params} searchParams={searchParams} />
      </Suspense>
    </AdminDetailPage>
  );
}

async function ExamDetailContent({ params, searchParams }: PageProps<"/exams/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  if (!isUuid(id)) {
    notFound();
  }

  const exam = await getExam(id);

  if (!exam) {
    notFound();
  }

  const tab = readAdminTab({ tabs: EXAM_TABS, value: query.tab });

  return (
    <>
      <AdminDetailHeader
        actions={
          <ExamActions
            examId={exam.id}
            examName={exam.name}
            hasNotice={Boolean(exam.source)}
            hasSkillGraph={Boolean(exam.skillGraph)}
          />
        }
        facts={[exam.board, exam.role, countryName(exam.country), languageName(exam.language)]}
        parents={EXAM_PARENTS}
        title={exam.name}
      />

      <AdminDetailBody>
        <AdminRecordTabs current={tab} label="Exam" path={`/exams/${exam.id}`} tabs={EXAM_TABS} />

        {tab === "overview" ? (
          <>
            <ExamTotals exam={exam} />

            <AdminDetailColumns aside={<ExamChecking exam={exam} />}>
              <ExamEditionDates exam={exam} />

              <Suspense fallback={<AdminSectionSkeleton description />}>
                <ExamEditionHistory examBlueprintId={exam.id} />
              </Suspense>
            </AdminDetailColumns>
          </>
        ) : null}

        {tab === "blueprint" ? <ExamBlueprint exam={exam} /> : null}
        {tab === "graph" ? <ExamSkillGraph exam={exam} showAll={query.all === "1"} /> : null}

        {tab === "details" ? (
          <AdminDetailColumns aside={<ExamWrittenBy exam={exam} />}>
            <ExamDetails exam={exam} />
          </AdminDetailColumns>
        ) : null}
      </AdminDetailBody>
    </>
  );
}

function ExamDetailSkeleton() {
  return (
    <>
      <AdminDetailHeaderSkeleton actions="buttons" parents={EXAM_PARENTS} />

      <AdminDetailBody>
        <div className={STAT_TILES_CLASS}>
          {Array.from({ length: 4 }, (_, index) => (
            <StatTileSkeleton key={index} />
          ))}
        </div>
        <AdminSectionSkeleton />
      </AdminDetailBody>
    </>
  );
}
