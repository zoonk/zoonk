import { AdminNameCell } from "@/components/admin-name-cell";
import { AdminTableRow } from "@/components/admin-table-row";
import { type ListedSkill } from "@/data/skills/list-skills";
import { toWords } from "@/lib/format";
import { languageName } from "@/lib/language-filter";
import { TableCell } from "@zoonk/ui/components/table";

export function SkillRow({ skill }: { skill: ListedSkill }) {
  return (
    <AdminTableRow>
      <AdminNameCell
        href={`/skills/${skill.id}`}
        note={[
          languageName(skill.language),
          skill.visibility === "private" && "Private",
          skill.mergedIntoId && "Merged into another skill",
        ]
          .filter(Boolean)
          .join(" · ")}
        title={skill.name}
      />
      <TableCell>{skill.level ? toWords(skill.level) : null}</TableCell>
      <TableCell numeric>{skill._count.lessons.toLocaleString("en")}</TableCell>
      <TableCell numeric>{skill._count.items.toLocaleString("en")}</TableCell>
      <TableCell numeric>{skill._count.learnerSkills.toLocaleString("en")}</TableCell>
    </AdminTableRow>
  );
}
