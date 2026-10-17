import { AdminSection } from "@/components/admin-section";
import { DetailField } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { type AdminSkill, getSkill } from "@/data/skills/get-skill";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MergeSkillDialog } from "./merge-skill-dialog";

/** The skill's study card, identity and ownership, with where a merge sent it. */
export async function SkillOverview({ skillId }: { skillId: string }) {
  "use cache: private";

  const skill = await getSkill(skillId);

  if (!skill) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{skill.name}</h2>
          {!skill.mergedInto && <MergeSkillDialog skillId={skill.id} />}
        </div>
        <SkillCard label="Card front" text={skill.description} />
        <SkillCard label="Card back" text={skill.example} />
      </div>

      <AdminSection title="Skill">
        <dl className="divide-y">
          <DetailField label="Identity key">
            <span className="font-mono text-xs break-all">{skill.identityKey}</span>
          </DetailField>
          <DetailField label="Language">
            <span className="uppercase">{skill.language}</span>
          </DetailField>
          <DetailField label="Target language">
            <span className="uppercase">{skill.targetLanguage ?? "—"}</span>
          </DetailField>
          <DetailField label="Level">
            <span className="capitalize">{skill.level ?? "—"}</span>
          </DetailField>
          <DetailField label="Visibility">
            <span className="capitalize">{skill.visibility}</span>
          </DetailField>
          <DetailField label="Owner">
            <SkillOwner owner={skill.owner} />
          </DetailField>
          <DetailField label="Merged into">
            <SkillLinks skills={skill.mergedInto ? [skill.mergedInto] : []} />
          </DetailField>
          <DetailField label="Merged into this skill">
            <SkillLinks skills={skill.mergedSkills} />
          </DetailField>
          <DetailField label="Created">{formatDateTime(skill.createdAt)}</DetailField>
          <DetailField label="Updated">{formatDateTime(skill.updatedAt)}</DetailField>
        </dl>
      </AdminSection>

      <AdminSection title="Provenance">
        <ProvenanceFields provenance={skill} />
      </AdminSection>
    </div>
  );
}

function SkillCard({ label, text }: { label: string; text: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <p className="text-sm whitespace-pre-wrap">{text ?? "—"}</p>
    </div>
  );
}

/** Private skills belong to one learner; public skills have no owner. */
function SkillOwner({ owner }: { owner: AdminSkill["owner"] }) {
  if (!owner) {
    return "—";
  }

  return (
    <Link className="hover:underline" href={`/users/${owner.id}`} prefetch>
      {owner.name || owner.email}
    </Link>
  );
}

function SkillLinks({ skills }: { skills: AdminSkill["mergedSkills"] }) {
  if (skills.length === 0) {
    return "—";
  }

  return (
    <span className="flex flex-col items-end gap-1">
      {skills.map((skill) => (
        <Link className="hover:underline" href={`/skills/${skill.id}`} key={skill.id} prefetch>
          {skill.name} <span className="text-muted-foreground uppercase">{skill.language}</span>
        </Link>
      ))}
    </span>
  );
}
