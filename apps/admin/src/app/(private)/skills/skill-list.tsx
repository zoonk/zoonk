import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { AdminPagination } from "@/components/pagination";
import { listSkills } from "@/data/skills/list-skills";
import { parseSearchParams } from "@/lib/parse-search-params";
import { type LibraryVisibility } from "@zoonk/db";
import { getSkillListQueryParams, parseSkillListFilters } from "./_utils/skill-list-params";
import { SkillRow } from "./skill-row";

const SKILL_COLUMNS: AdminTableColumn[] = [
  { label: "Skill" },
  { label: "Language" },
  { label: "Level" },
  { label: "Visibility" },
  { align: "right", label: "Lessons" },
  { align: "right", label: "Items" },
  { align: "right", label: "Learners" },
  { align: "right", label: "Prerequisites" },
  { label: "Provenance" },
  { label: "Created" },
];

/** Resolves the URL into primitive filters so each list state is its own cache entry. */
export async function SkillList({ searchParams }: Pick<PageProps<"/skills">, "searchParams">) {
  const params = await searchParams;
  const { limit, offset, page } = parseSearchParams(params);
  const filters = parseSkillListFilters(params);

  return (
    <CachedSkillList
      includeMerged={filters.includeMerged}
      language={filters.language}
      limit={limit}
      offset={offset}
      page={page}
      search={filters.search}
      visibility={filters.visibility}
    />
  );
}

async function CachedSkillList({
  includeMerged,
  language,
  limit,
  offset,
  page,
  search,
  visibility,
}: {
  includeMerged: boolean;
  language?: string;
  limit: number;
  offset: number;
  page: number;
  search?: string;
  visibility?: LibraryVisibility;
}) {
  "use cache: private";

  const { skills, total } = await listSkills({
    includeMerged,
    language,
    limit,
    offset,
    search,
    visibility,
  });

  return (
    <>
      <AdminTableColumns
        columns={SKILL_COLUMNS}
        emptyLabel="No skills found."
        isEmpty={skills.length === 0}
      >
        {skills.map((skill) => (
          <SkillRow key={skill.id} skill={skill} />
        ))}
      </AdminTableColumns>

      <AdminPagination
        basePath="/skills"
        limit={limit}
        page={page}
        queryParams={getSkillListQueryParams({ includeMerged, language, visibility })}
        search={search}
        totalPages={Math.ceil(total / limit)}
      />
    </>
  );
}

export function SkillListSkeleton() {
  return <AdminTableColumnsSkeleton columns={SKILL_COLUMNS} />;
}
