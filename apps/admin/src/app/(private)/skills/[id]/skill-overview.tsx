import { AdminSection } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { type AdminSkill } from "@/data/skills/get-skill";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";

export function SkillOverview({ skill }: { skill: AdminSkill }) {
  return (
    <>
      <AdminSection title="Details">
        <DetailFields>
          <DetailField label="Card front">
            <span className="whitespace-pre-wrap">{skill.description ?? "—"}</span>
          </DetailField>
          <DetailField label="Card back">
            <span className="whitespace-pre-wrap">{skill.example ?? "—"}</span>
          </DetailField>
          <DetailField label="Identity key">
            <span className="font-mono text-xs break-all">{skill.identityKey}</span>
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
        </DetailFields>
      </AdminSection>

      <AdminSection title="Provenance">
        <ProvenanceFields provenance={skill} />
      </AdminSection>
    </>
  );
}

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
    <span className="flex flex-col gap-1">
      {skills.map((skill) => (
        <Link className="hover:underline" href={`/skills/${skill.id}`} key={skill.id} prefetch>
          {skill.name} <span className="text-muted-foreground uppercase">{skill.language}</span>
        </Link>
      ))}
    </span>
  );
}
