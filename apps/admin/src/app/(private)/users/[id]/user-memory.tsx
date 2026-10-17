import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { type UserMemory, listUserMemory } from "@/data/users/list-user-memory";
import { formatDate } from "@/lib/format";
import { Badge } from "@zoonk/ui/components/badge";
import { EraseMemoryFactDialog } from "./erase-memory-fact-dialog";

type MemoryFactRow = UserMemory["facts"][number];

/** Sensitive facts stay folded, so reading the page for another reason doesn't expose them. */
function FactStatement({ fact }: { fact: MemoryFactRow }) {
  if (!fact.sensitive) {
    return <span>{fact.statement}</span>;
  }

  return (
    <details>
      <summary className="cursor-pointer">Sensitive fact (show)</summary>
      <span>{fact.statement}</span>
    </details>
  );
}

function FactRow({ fact, userId }: { fact: MemoryFactRow; userId: string }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-2">
      <span className="flex flex-col gap-0.5 text-sm">
        <FactStatement fact={fact} />
        <span className="text-muted-foreground text-xs">
          {fact.category} · {fact.origin} · {formatDate(fact.createdAt)}
          {fact.expiresAt ? ` · expires ${formatDate(fact.expiresAt)}` : ""}
          {fact.model ? ` · ${fact.model}` : ""}
        </span>
      </span>
      <span className="flex items-center gap-2">
        {fact.status === "active" ? null : (
          <Badge className="capitalize" variant="outline">
            {fact.status}
          </Badge>
        )}
        <EraseMemoryFactDialog factId={fact.id} userId={userId} />
      </span>
    </li>
  );
}

/**
 * What Zoonk remembers about the learner, with an erase action for support requests, and the
 * latest daily insights it offered them.
 */
export async function UserMemorySection({ userId }: { userId: string }) {
  "use cache: private";

  const { facts, insights } = await listUserMemory(userId);
  const shownInsights = insights.filter((insight) => insight.message);

  return (
    <AdminSection
      description="Replaced and deleted facts are kept 30 days for undo. Erasing removes a fact now."
      title={`Memory (${facts.length} facts)`}
    >
      {facts.length === 0 ? (
        <AdminSectionEmpty>Nothing remembered.</AdminSectionEmpty>
      ) : (
        <ul className="flex flex-col divide-y">
          {facts.map((fact) => (
            <FactRow fact={fact} key={fact.id} userId={userId} />
          ))}
        </ul>
      )}

      {shownInsights.length > 0 ? (
        <div className="mt-4 flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium">Latest insights</span>
          <ul className="flex flex-col gap-1 text-sm">
            {shownInsights.map((insight) => (
              <li key={insight.id}>
                {insight.message}
                <span className="text-muted-foreground text-xs">
                  {" · "}
                  {formatDate(insight.localDate)} · {insight.kind} · {insight.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </AdminSection>
  );
}
