import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { type UserMemory, listUserMemory } from "@/data/users/list-user-memory";
import { formatDate, toWords } from "@/lib/format";
import { EraseMemoryFactButton } from "./erase-memory-fact-button";

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
  const facts = [
    fact.status !== "active" && toWords(fact.status),
    toWords(fact.category),
    toWords(fact.origin),
    formatDate(fact.createdAt),
    fact.expiresAt && `expires ${formatDate(fact.expiresAt)}`,
  ];

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-2.5">
      <span className="flex max-w-3xl flex-col gap-0.5 text-sm">
        <FactStatement fact={fact} />
        <span className="text-muted-foreground text-xs">{facts.filter(Boolean).join(" · ")}</span>
      </span>
      <EraseMemoryFactButton factId={fact.id} userId={userId} />
    </li>
  );
}

export async function UserMemorySection({ userId }: { userId: string }) {
  "use cache: private";

  const { facts, insights } = await listUserMemory(userId);
  const shownInsights = insights.filter((insight) => insight.message);

  return (
    <>
      <AdminSection title={`What Zoonk remembers (${facts.length})`}>
        {facts.length === 0 ? (
          <AdminSectionEmpty>Nothing remembered.</AdminSectionEmpty>
        ) : (
          <ul className="flex flex-col divide-y">
            {facts.map((fact) => (
              <FactRow fact={fact} key={fact.id} userId={userId} />
            ))}
          </ul>
        )}
      </AdminSection>

      {shownInsights.length > 0 ? (
        <AdminSection title="Latest insights">
          <ul className="flex flex-col divide-y text-sm">
            {shownInsights.map((insight) => (
              <li className="flex max-w-3xl flex-col gap-0.5 py-2.5" key={insight.id}>
                <span>{insight.message}</span>
                <span className="text-muted-foreground text-xs">
                  {[formatDate(insight.localDate), insight.kind, insight.status]
                    .flatMap((value) => (value ? [toWords(value)] : []))
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </AdminSection>
      ) : null}
    </>
  );
}
