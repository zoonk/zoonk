import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { AdminPagination } from "@/components/pagination";
import { type PromptOutcome } from "@/data/prompts/_utils/prompt-outcomes";
import { listPrompts } from "@/data/prompts/list-prompts";
import { parseSearchParams } from "@/lib/parse-search-params";
import { parsePromptOutcome } from "./_utils/prompt-labels";
import { PromptRow } from "./prompt-row";

const columns: AdminTableColumn[] = [
  { label: "Prompt" },
  { label: "Learner" },
  { label: "Language" },
  { label: "Read as" },
  { label: "Outcome" },
  { label: "Date" },
];

export async function PromptList({ searchParams }: Pick<PageProps<"/prompts">, "searchParams">) {
  const params = await searchParams;
  const { limit, offset, page, search } = parseSearchParams(params);

  return (
    <CachedPromptList
      limit={limit}
      offset={offset}
      outcome={parsePromptOutcome(params)}
      page={page}
      search={search}
    />
  );
}

async function CachedPromptList({
  limit,
  offset,
  outcome,
  page,
  search,
}: {
  limit: number;
  offset: number;
  outcome?: PromptOutcome;
  page: number;
  search?: string;
}) {
  "use cache: private";

  const { prompts, total } = await listPrompts({ limit, offset, outcome, search });

  return (
    <>
      <AdminTableColumns
        columns={columns}
        emptyLabel={outcome || search ? "No prompts match." : "No prompts yet."}
        isEmpty={prompts.length === 0}
      >
        {prompts.map((prompt) => (
          <PromptRow key={prompt.id} prompt={prompt} />
        ))}
      </AdminTableColumns>

      <AdminPagination
        basePath="/prompts"
        limit={limit}
        page={page}
        queryParams={{ outcome }}
        search={search}
        totalPages={Math.ceil(total / limit)}
      />
    </>
  );
}

export function PromptListSkeleton() {
  return <AdminTableColumnsSkeleton columns={columns} />;
}
