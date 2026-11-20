import { AdminNameCell } from "@/components/admin-name-cell";
import { AdminSection, AdminSectionEmpty, AdminSectionMore } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow } from "@/components/admin-table-row";
import { BarList } from "@/components/bar-list";
import { type AdminExam } from "@/data/exams/get-exam";
import { formatCount } from "@/lib/format";
import { parsePlanGraph } from "@zoonk/core/plans/plan-state";
import { TableCell } from "@zoonk/ui/components/table";

const SKILL_COLUMNS: AdminTableColumn[] = [
  { label: "Skill" },
  { label: "Area", size: "wide" },
  { align: "right", label: "Weight" },
  { align: "right", label: "Lessons" },
];

const SHOWN_SKILLS = 12;
const NO_AREA = "No area";

type GraphSkill = ReturnType<typeof parsePlanGraph>["skills"][number];

/** Each area's skills and lessons, the area with the most lessons first. */
function rankAreas(skills: GraphSkill[]) {
  const areas = Map.groupBy(skills, (skill) => skill.area ?? NO_AREA);

  return [...areas]
    .map(([name, areaSkills]) => ({
      lessons: areaSkills.reduce((total, skill) => total + skill.lessons, 0),
      name,
      skills: areaSkills.length,
    }))
    .toSorted((first, second) => second.lessons - first.lessons);
}

/** What every new learner of the exam plans from: where its lessons go, then each skill. */
export function ExamSkillGraph({ exam, showAll }: { exam: AdminExam; showAll: boolean }) {
  if (!exam.skillGraph) {
    return (
      <AdminSection title="Skills">
        <AdminSectionEmpty>
          No skill graph yet: the exam&apos;s next learner writes one.
        </AdminSectionEmpty>
      </AdminSection>
    );
  }

  const { skills } = parsePlanGraph(exam.skillGraph.graph);
  const shown = showAll ? skills : skills.slice(0, SHOWN_SKILLS);

  return (
    <>
      <AdminSection title="Lessons by area">
        <BarList
          rows={rankAreas(skills).map((area) => ({
            display: formatCount(area.lessons, "lesson"),
            key: area.name,
            name: area.name,
            note: formatCount(area.skills, "skill"),
            value: area.lessons,
          }))}
        />
      </AdminSection>

      <AdminSection title={`Skills (${skills.length.toLocaleString("en")})`}>
        <AdminTableColumns
          columns={SKILL_COLUMNS}
          emptyLabel="The skill graph has no skills."
          isEmpty={skills.length === 0}
        >
          {shown.map((skill) => (
            <AdminTableRow key={skill.skillId}>
              <AdminNameCell href={`/skills/${skill.skillId}`} title={skill.name} />
              <TableCell className="whitespace-normal">{skill.area}</TableCell>
              <TableCell numeric>{skill.weight}</TableCell>
              <TableCell numeric>{skill.lessons.toLocaleString("en")}</TableCell>
            </AdminTableRow>
          ))}
        </AdminTableColumns>

        {skills.length > shown.length ? (
          <AdminSectionMore href={`/exams/${exam.id}?tab=graph&all=1`}>
            Show all {skills.length.toLocaleString("en")} skills
          </AdminSectionMore>
        ) : null}
      </AdminSection>
    </>
  );
}
