import {
  AdminDetailBody,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { getSkill } from "@/data/skills/get-skill";
import { capitalize } from "@/lib/format";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SkillActionsMenu } from "./skill-actions-menu";
import { SkillGraph } from "./skill-graph";
import { SkillLearners } from "./skill-learners";
import { SkillOverview } from "./skill-overview";
import { SkillUsage } from "./skill-usage";

export const metadata: Metadata = { title: "Skill" };

const SKILL_PARENTS = [{ href: "/skills", label: "Skills" }];

export default function SkillDetailPage({ params }: PageProps<"/skills/[id]">) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<SkillDetailSkeleton />}>
        <SkillDetailContent params={params} />
      </Suspense>
    </AdminDetailPage>
  );
}

async function SkillDetailContent({ params }: Pick<PageProps<"/skills/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const skill = await getSkill(id);

  if (!skill) {
    notFound();
  }

  const language = skill.language.toUpperCase();

  return (
    <>
      <AdminDetailHeader
        menu={skill.mergedInto ? null : <SkillActionsMenu skillId={skill.id} />}
        facts={[
          skill.targetLanguage ? `${language} → ${skill.targetLanguage.toUpperCase()}` : language,
          skill.level && capitalize(skill.level),
          capitalize(skill.visibility),
          skill.mergedInto && `Merged into ${skill.mergedInto.name}`,
        ]}
        parents={SKILL_PARENTS}
        title={skill.name}
      />

      <AdminDetailBody>
        <SkillOverview skill={skill} />

        <Suspense fallback={<AdminSectionSkeleton description />}>
          <SkillGraph skillId={skill.id} />
        </Suspense>

        <Suspense fallback={<AdminSectionSkeleton description />}>
          <SkillLearners skillId={skill.id} />
        </Suspense>

        <Suspense fallback={<AdminSectionSkeleton description />}>
          <SkillUsage skillId={skill.id} />
        </Suspense>
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
