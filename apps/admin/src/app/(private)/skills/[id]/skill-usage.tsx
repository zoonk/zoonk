import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { StateMark } from "@/components/state-mark";
import { getSkill } from "@/data/skills/get-skill";
import { MAX_SKILL_USAGE_ROWS, getSkillUsage } from "@/data/skills/get-skill-usage";
import { toWords } from "@/lib/format";
import { ITEM_FORMAT_LABELS, getItemLabel } from "@/lib/item-label";
import { languageName } from "@/lib/language-filter";
import { libraryLessonStatusLabels } from "@/lib/library-lesson-filters";
import { TableCell } from "@zoonk/ui/components/table";

type SkillUsageRows = Awaited<ReturnType<typeof getSkillUsage>>;

const LESSON_COLUMNS: AdminTableColumn[] = [
  { label: "Lesson" },
  { label: "Level" },
  { label: "State", size: "wide" },
];

const CHAPTER_COLUMNS: AdminTableColumn[] = [{ label: "Chapter" }, { label: "Level" }];

const ITEM_COLUMNS: AdminTableColumn[] = [
  { label: "Question" },
  { label: "Format", size: "wide" },
  { label: "Language" },
];

function getUsageDescription(total: number): string | undefined {
  return total > MAX_SKILL_USAGE_ROWS ? `Showing the first ${MAX_SKILL_USAGE_ROWS}.` : undefined;
}

export async function SkillUsage({ skillId }: { skillId: string }) {
  "use cache: private";

  const [skill, usage] = await Promise.all([getSkill(skillId), getSkillUsage(skillId)]);
  const counts = skill?._count ?? { chapters: 0, items: 0, lessons: 0 };

  return (
    <div className="flex flex-col gap-8">
      <AdminSection
        description={getUsageDescription(counts.lessons)}
        title={`Lessons (${counts.lessons})`}
      >
        <SkillLessonsTable lessons={usage.lessons} />
      </AdminSection>

      <AdminSection
        description={getUsageDescription(counts.chapters)}
        title={`Chapters (${counts.chapters})`}
      >
        <SkillChaptersTable chapters={usage.chapters} />
      </AdminSection>

      <AdminSection
        description={getUsageDescription(counts.items)}
        title={`Practice questions (${counts.items})`}
      >
        <SkillItemsTable items={usage.items} />
      </AdminSection>
    </div>
  );
}

function SkillLessonsTable({ lessons }: { lessons: SkillUsageRows["lessons"] }) {
  return (
    <AdminTableColumns
      columns={LESSON_COLUMNS}
      emptyLabel="No lesson teaches this skill."
      isEmpty={lessons.length === 0}
    >
      {lessons.map((lesson) => (
        <AdminTableRow key={lesson.id}>
          <TableCell className="text-foreground whitespace-normal">
            <AdminTableRowLink href={`/lessons/${lesson.id}`} prefetch={false}>
              {lesson.title}
            </AdminTableRowLink>
          </TableCell>
          <TableCell>{toWords(lesson.level)}</TableCell>
          <TableCell>
            <StateMark state={lesson.contentStatus}>
              {libraryLessonStatusLabels[lesson.contentStatus]}
            </StateMark>
          </TableCell>
        </AdminTableRow>
      ))}
    </AdminTableColumns>
  );
}

function SkillChaptersTable({ chapters }: { chapters: SkillUsageRows["chapters"] }) {
  return (
    <AdminTableColumns
      columns={CHAPTER_COLUMNS}
      emptyLabel="No chapter was tagged with this skill."
      isEmpty={chapters.length === 0}
    >
      {chapters.map((chapter) => (
        <AdminTableRow key={chapter.id}>
          <TableCell className="text-foreground whitespace-normal">{chapter.title}</TableCell>
          <TableCell>{toWords(chapter.level)}</TableCell>
        </AdminTableRow>
      ))}
    </AdminTableColumns>
  );
}

function SkillItemsTable({ items }: { items: SkillUsageRows["items"] }) {
  return (
    <AdminTableColumns
      columns={ITEM_COLUMNS}
      emptyLabel="No practice question tests this skill."
      isEmpty={items.length === 0}
    >
      {items.map((item) => (
        <AdminTableRow key={item.id}>
          <TableCell className="text-foreground whitespace-normal">
            <AdminTableRowLink href={`/items/${item.id}`} prefetch={false}>
              <span className="line-clamp-2">{getItemLabel(item)}</span>
            </AdminTableRowLink>
          </TableCell>
          <TableCell>{ITEM_FORMAT_LABELS[item.format]}</TableCell>
          <TableCell>{languageName(item.language)}</TableCell>
        </AdminTableRow>
      ))}
    </AdminTableColumns>
  );
}
