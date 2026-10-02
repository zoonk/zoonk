import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { getUserLearnerSkills } from "@/data/users/get-user-learner-skills";
import { formatDate } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import Link from "next/link";

type RecentLearnerSkill = Awaited<ReturnType<typeof getUserLearnerSkills>>["recent"][number];

function LearnerSkillRow({ learnerSkill }: { learnerSkill: RecentLearnerSkill }) {
  return (
    <TableRow>
      <TableCell>
        <Link className="hover:underline" href={`/skills/${learnerSkill.skill.id}`}>
          {learnerSkill.skill.name}
        </Link>
      </TableCell>
      <TableCell className="capitalize">{learnerSkill.state}</TableCell>
      <TableCell>{formatDate(learnerSkill.due)}</TableCell>
      <TableCell className="text-right tabular-nums">{learnerSkill.reps}</TableCell>
      <TableCell className="text-right tabular-nums">{learnerSkill.lapses}</TableCell>
      <TableCell className="text-right tabular-nums">{learnerSkill.recallDays}</TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(learnerSkill.lastReviewedAt)}
      </TableCell>
    </TableRow>
  );
}

/**
 * The learner's skills by mastery state, then the most recently practiced ones with their review
 * schedule (FSRS due date, reps, lapses and days remembered).
 */
export async function UserLearnerSkills({ userId }: { userId: string }) {
  "use cache: private";

  const { recent, states, total } = await getUserLearnerSkills(userId);

  return (
    <AdminSection
      description={states.map((row) => `${row.count} ${row.state}`).join(" · ")}
      title={`Skills (${total})`}
    >
      {recent.length === 0 ? (
        <AdminSectionEmpty>No skills practiced yet.</AdminSectionEmpty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Skill</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Reps</TableHead>
                <TableHead className="text-right">Lapses</TableHead>
                <TableHead className="text-right">Days remembered</TableHead>
                <TableHead>Last review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((learnerSkill) => (
                <LearnerSkillRow key={learnerSkill.id} learnerSkill={learnerSkill} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminSection>
  );
}
