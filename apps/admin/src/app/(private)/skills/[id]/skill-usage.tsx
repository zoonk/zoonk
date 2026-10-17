import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { getSkill } from "@/data/skills/get-skill";
import { MAX_SKILL_USAGE_ROWS, getSkillUsage } from "@/data/skills/get-skill-usage";
import { ITEM_FORMAT_LABELS, getItemLabel } from "@/lib/item-label";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";

type SkillUsageRows = Awaited<ReturnType<typeof getSkillUsage>>;

const LESSON_COLUMNS: AdminTableColumn[] = [
  { label: "Lesson" },
  { label: "Level" },
  { label: "Visibility" },
  { label: "Content" },
];

const CHAPTER_COLUMNS: AdminTableColumn[] = [
  { label: "Chapter" },
  { label: "Level" },
  { label: "Visibility" },
];

const ITEM_COLUMNS: AdminTableColumn[] = [
  { label: "Item" },
  { label: "Format" },
  { label: "Language" },
  { label: "Field" },
];

/** Tables show the first rows; past that, the section says so next to the full count. */
function getUsageDescription(total: number): string | undefined {
  return total > MAX_SKILL_USAGE_ROWS ? `Showing the first ${MAX_SKILL_USAGE_ROWS}.` : undefined;
}

/** Where the skill is taught (lessons, chapters) and practiced (items). */
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
        title={`Items (${counts.items})`}
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
        <TableRow key={lesson.id}>
          <TableCell className="max-w-96 min-w-56 whitespace-normal">
            <Link className="hover:underline" href={`/lessons/${lesson.id}`} prefetch={false}>
              {lesson.title}
            </Link>
          </TableCell>
          <TableCell className="capitalize">{lesson.level}</TableCell>
          <TableCell className="capitalize">{lesson.visibility}</TableCell>
          <TableCell className="capitalize">{lesson.contentStatus}</TableCell>
        </TableRow>
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
        <TableRow key={chapter.id}>
          <TableCell className="max-w-96 min-w-56 whitespace-normal">{chapter.title}</TableCell>
          <TableCell className="capitalize">{chapter.level}</TableCell>
          <TableCell className="capitalize">{chapter.visibility}</TableCell>
        </TableRow>
      ))}
    </AdminTableColumns>
  );
}

function SkillItemsTable({ items }: { items: SkillUsageRows["items"] }) {
  return (
    <AdminTableColumns
      columns={ITEM_COLUMNS}
      emptyLabel="No item practices this skill."
      isEmpty={items.length === 0}
    >
      {items.map((item) => (
        <TableRow key={item.id}>
          <TableCell className="max-w-96 min-w-56 whitespace-normal">
            <Link
              className="line-clamp-2 hover:underline"
              href={`/items/${item.id}`}
              prefetch={false}
            >
              {getItemLabel(item)}
            </Link>
          </TableCell>
          <TableCell>{ITEM_FORMAT_LABELS[item.format]}</TableCell>
          <TableCell className="uppercase">{item.language}</TableCell>
          <TableCell>{item.field ?? "—"}</TableCell>
        </TableRow>
      ))}
    </AdminTableColumns>
  );
}
