import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { type AdminSkill } from "@/data/skills/get-skill";
import { formatDateTime } from "@/lib/format";
import { languageName } from "@/lib/language-filter";
import { LINK_CLASS } from "@/lib/link-class";
import Link from "next/link";

/** The card learners review: its front, and the example on its back. */
export function SkillCard({ skill }: { skill: AdminSkill }) {
  return (
    <AdminSection title="What the learner sees">
      {skill.description || skill.example ? (
        <div className="flex max-w-2xl flex-col gap-3 text-sm leading-6 whitespace-pre-wrap">
          {skill.description ? <p className="font-medium">{skill.description}</p> : null}
          {skill.example ? <p>{skill.example}</p> : null}
        </div>
      ) : (
        <AdminSectionEmpty>Its review card isn&apos;t written yet.</AdminSectionEmpty>
      )}
    </AdminSection>
  );
}

export function SkillUsedIn({ skill }: { skill: AdminSkill }) {
  const href = `/skills/${skill.id}?tab=used` as const;

  const rows = [
    { count: skill._count.lessons, label: "Lessons" },
    { count: skill._count.chapters, label: "Chapters" },
    { count: skill._count.items, label: "Practice questions" },
  ];

  return (
    <AdminSection title="Used in">
      <DetailFields>
        {rows.map((row) => (
          <DetailField key={row.label} label={row.label}>
            <Link className={LINK_CLASS} href={href} prefetch>
              {row.count.toLocaleString("en")}
            </Link>
          </DetailField>
        ))}
      </DetailFields>
    </AdminSection>
  );
}

export function SkillDetails({ skill }: { skill: AdminSkill }) {
  return (
    <AdminSection title="Details">
      <DetailFields>
        <DetailField label="Identity key">{skill.identityKey}</DetailField>
        <DetailField label="Open to">
          {skill.owner ? (
            <Link className={LINK_CLASS} href={`/users/${skill.owner.id}`} prefetch>
              Only {skill.owner.name || skill.owner.email}
            </Link>
          ) : (
            "Everyone"
          )}
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
  );
}

export function SkillWrittenBy({ skill }: { skill: AdminSkill }) {
  return (
    <AdminSection title="Written by">
      <ProvenanceFields provenance={skill} />
    </AdminSection>
  );
}

function SkillLinks({ skills }: { skills: AdminSkill["mergedSkills"] }) {
  if (skills.length === 0) {
    return null;
  }

  return (
    <span className="flex flex-col gap-1">
      {skills.map((skill) => (
        <span key={skill.id}>
          <Link className={LINK_CLASS} href={`/skills/${skill.id}`} prefetch>
            {skill.name}
          </Link>{" "}
          <span className="text-muted-foreground text-xs">{languageName(skill.language)}</span>
        </span>
      ))}
    </span>
  );
}
