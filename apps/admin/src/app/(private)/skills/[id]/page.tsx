import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { AdminRecordTabs, readAdminTab } from "@/components/admin-tabs";
import { getSkill } from "@/data/skills/get-skill";
import { toWords } from "@/lib/format";
import { languagePairName } from "@/lib/language-filter";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SkillActionsMenu } from "./skill-actions-menu";
import { SkillGraph } from "./skill-graph";
import { SkillLearners } from "./skill-learners";
import { SkillCard, SkillDetails, SkillUsedIn, SkillWrittenBy } from "./skill-overview";
import { SkillUsage } from "./skill-usage";

export async function generateMetadata({ params }: PageProps<"/skills/[id]">): Promise<Metadata> {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const record = await getSkill(id);

  if (!record) {
    notFound();
  }

  return { title: record.name };
}

const SKILL_PARENTS = [{ href: "/skills", label: "Skills" }];

const SKILL_TABS = [
  { label: "Overview", value: "overview" },
  { label: "Used in", value: "used" },
  { label: "Details", value: "details" },
] as const;

export default function SkillDetailPage({ params, searchParams }: PageProps<"/skills/[id]">) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<SkillDetailSkeleton />}>
        <SkillDetailContent params={params} searchParams={searchParams} />
      </Suspense>
    </AdminDetailPage>
  );
}

async function SkillDetailContent({ params, searchParams }: PageProps<"/skills/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  if (!isUuid(id)) {
    notFound();
  }

  const skill = await getSkill(id);

  if (!skill) {
    notFound();
  }

  const tab = readAdminTab({ tabs: SKILL_TABS, value: query.tab });

  return (
    <>
      <AdminDetailHeader
        facts={[
          skill.level && toWords(skill.level),
          languagePairName(skill),
          skill.visibility === "private" ? "Private" : "Open to everyone",
          skill.mergedInto && `Merged into ${skill.mergedInto.name}`,
        ]}
        menu={
          skill.mergedInto ? null : <SkillActionsMenu skillId={skill.id} skillName={skill.name} />
        }
        parents={SKILL_PARENTS}
        title={skill.name}
      />

      <AdminDetailBody>
        <AdminRecordTabs
          current={tab}
          label="Skill"
          path={`/skills/${skill.id}`}
          tabs={SKILL_TABS}
        />

        {tab === "overview" ? (
          <AdminDetailColumns
            aside={
              <>
                <Suspense fallback={<AdminSectionSkeleton rows={2} />}>
                  <SkillLearners skillId={skill.id} />
                </Suspense>
                <SkillUsedIn skill={skill} />
              </>
            }
          >
            <SkillCard skill={skill} />
            <Suspense fallback={<AdminSectionSkeleton />}>
              <SkillGraph skillId={skill.id} />
            </Suspense>
          </AdminDetailColumns>
        ) : null}

        {tab === "used" ? (
          <Suspense fallback={<AdminSectionSkeleton description />}>
            <SkillUsage skillId={skill.id} />
          </Suspense>
        ) : null}

        {tab === "details" ? (
          <AdminDetailColumns aside={<SkillWrittenBy skill={skill} />}>
            <SkillDetails skill={skill} />
          </AdminDetailColumns>
        ) : null}
      </AdminDetailBody>
    </>
  );
}

function SkillDetailSkeleton() {
  return (
    <>
      <AdminDetailHeaderSkeleton actions="menu" parents={SKILL_PARENTS} />

      <AdminDetailBody>
        <AdminSectionSkeleton rows={8} />
        <AdminSectionSkeleton />
      </AdminDetailBody>
    </>
  );
}
