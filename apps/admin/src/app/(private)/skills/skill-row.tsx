import { ProvenanceLine } from "@/components/provenance";
import { type ListedSkill } from "@/data/skills/list-skills";
import { formatDate } from "@/lib/format";
import { Badge } from "@zoonk/ui/components/badge";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";

export function SkillRow({ skill }: { skill: ListedSkill }) {
  return (
    <TableRow>
      <TableCell className="max-w-80 min-w-56 whitespace-normal">
        <Link className="font-medium hover:underline" href={`/skills/${skill.id}`} prefetch>
          {skill.name}
        </Link>
        {skill.mergedIntoId ? (
          <Badge className="ml-2" variant="outline">
            Merged
          </Badge>
        ) : null}
      </TableCell>
      <TableCell className="uppercase">{skill.language}</TableCell>
      <TableCell className="capitalize">{skill.level ?? "—"}</TableCell>
      <TableCell className="capitalize">{skill.visibility}</TableCell>
      <TableCell className="text-right tabular-nums">{skill._count.lessons}</TableCell>
      <TableCell className="text-right tabular-nums">{skill._count.items}</TableCell>
      <TableCell className="text-right tabular-nums">{skill._count.learnerSkills}</TableCell>
      <TableCell className="text-right tabular-nums">{skill._count.prerequisites}</TableCell>
      <TableCell>
        <ProvenanceLine provenance={skill} />
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(skill.createdAt)}</TableCell>
    </TableRow>
  );
}
