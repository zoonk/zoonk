import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { type GraphSkill, getSkillGraph } from "@/data/skills/get-skill-graph";
import { toWords } from "@/lib/format";
import { cn } from "@zoonk/ui/lib/utils";
import Link from "next/link";

function SkillRows({ empty, skills }: { empty: string; skills: GraphSkill[] }) {
  if (skills.length === 0) {
    return <AdminSectionEmpty>{empty}</AdminSectionEmpty>;
  }

  return (
    <ul className="divide-y">
      {skills.map((skill) => (
        <li className="flex min-h-11 items-center justify-between gap-4 text-sm" key={skill.id}>
          <Link
            className={cn(
              "hit-area relative truncate hover:underline",
              skill.mergedIntoId && "text-muted-foreground line-through",
            )}
            href={`/skills/${skill.id}`}
            title={skill.mergedIntoId ? "Merged into another skill" : undefined}
          >
            {skill.name}
          </Link>
          {skill.level ? (
            <span className="text-muted-foreground shrink-0 text-xs">{toWords(skill.level)}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** The skill's place in the order learners meet skills: what comes right before it and right after. */
export async function SkillGraph({ skillId }: { skillId: string }) {
  "use cache: private";

  const { dependents, prerequisiteLayers } = await getSkillGraph(skillId);
  const before = prerequisiteLayers[0] ?? [];

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <AdminSection title={`Learned before this (${before.length})`}>
        <SkillRows empty="Nothing has to be learned first." skills={before} />
      </AdminSection>

      <AdminSection title={`Learned after this (${dependents.length})`}>
        <SkillRows empty="Nothing builds on it yet." skills={dependents} />
      </AdminSection>
    </div>
  );
}
