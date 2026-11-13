import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { type UserMemory, listUserMemory } from "@/data/users/list-user-memory";
import { formatDate, toWords } from "@/lib/format";
import { type MemoryCategory } from "@zoonk/db/enums";
import {
  CalendarClockIcon,
  EarIcon,
  EyeIcon,
  LightbulbIcon,
  type LucideIcon,
  MapPinIcon,
  SlidersHorizontalIcon,
  TargetIcon,
  UserRoundIcon,
} from "lucide-react";
import { EraseMemoryFactButton } from "./erase-memory-fact-button";

type MemoryFactRow = UserMemory["facts"][number];

/** What a fact is about. Goals wear the Goal requests page's icon. */
const CATEGORIES: Record<MemoryCategory, { icon: LucideIcon; label: string }> = {
  background: { icon: UserRoundIcon, label: "Background" },
  context: { icon: MapPinIcon, label: "Context" },
  goals: { icon: TargetIcon, label: "Goals" },
  learning: { icon: LightbulbIcon, label: "How they learn" },
  preferences: { icon: SlidersHorizontalIcon, label: "Preferences" },
  routine: { icon: CalendarClockIcon, label: "Routine" },
};

/** Where a fact came from: the learner said it, or Zoonk noticed it in how they study. */
const ORIGINS = {
  noticed: { icon: EyeIcon, label: "Noticed" },
  said: { icon: EarIcon, label: "They said it" },
};

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
  const origin = ORIGINS[fact.origin];

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      <span className="flex max-w-3xl flex-col gap-0.5 text-sm">
        <FactStatement fact={fact} />
        <span className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
          <origin.icon aria-hidden="true" className="size-3.5" />
          {[
            origin.label,
            fact.status !== "active" && toWords(fact.status),
            formatDate(fact.createdAt),
            fact.expiresAt && `expires ${formatDate(fact.expiresAt)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <EraseMemoryFactButton factId={fact.id} userId={userId} />
    </li>
  );
}

/** The facts under what each is about, so "what do we know about their routine" is one glance. */
function FactGroups({ facts, userId }: { facts: MemoryFactRow[]; userId: string }) {
  const groups = Map.groupBy(facts, (fact) => fact.category);

  return (
    <div className="flex flex-col gap-6">
      {[...groups].map(([category, rows]) => {
        const { icon: Icon, label } = CATEGORIES[category];

        return (
          <section className="flex flex-col" key={category}>
            <h3 className="flex items-center gap-2.5 border-b pb-2 text-sm font-medium">
              <Icon aria-hidden="true" className="text-muted-foreground size-4" />
              {label} ({rows.length})
            </h3>
            <ul className="flex flex-col divide-y ps-6.5">
              {rows.map((fact) => (
                <FactRow fact={fact} key={fact.id} userId={userId} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
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
          <FactGroups facts={facts} userId={userId} />
        )}
      </AdminSection>

      {shownInsights.length > 0 ? (
        <AdminSection title="Latest insights">
          <ul className="-my-2.5 flex flex-col divide-y text-sm">
            {shownInsights.map((insight) => (
              <li className="flex items-start gap-2.5 py-2.5" key={insight.id}>
                <LightbulbIcon
                  aria-hidden="true"
                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="max-w-3xl">{insight.message}</span>
                  <span className="text-muted-foreground text-xs">
                    {[formatDate(insight.localDate), insight.kind, insight.status]
                      .flatMap((value) => (value ? [toWords(value)] : []))
                      .join(" · ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </AdminSection>
      ) : null}
    </>
  );
}
