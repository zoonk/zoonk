import type { ActivityForList } from "@/data/activities/list-lesson-activities";
import { Link } from "@/i18n/navigation";
import type { ActivityKindInfo } from "@/lib/activities";
import { ActivityIndicator } from "./activity-indicator";

export function ActivityList({
  activities,
  baseHref,
  kindMeta,
}: {
  activities: ActivityForList[];
  baseHref: string;
  kindMeta: Map<string, ActivityKindInfo>;
}) {
  if (activities.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-1">
      {activities.map((activity) => {
        const meta = kindMeta.get(activity.kind);

        const title =
          activity.kind === "custom" && activity.title
            ? activity.title
            : meta?.label;

        const description =
          activity.kind === "custom" && activity.description
            ? activity.description
            : meta?.description;

        return (
          <li key={String(activity.id)}>
            <Link
              className="-mx-3 flex items-start gap-2.5 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/30"
              href={`${baseHref}/a/${activity.position}`}
            >
              <ActivityIndicator completed={false} />

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-medium text-foreground/90 text-sm leading-none">
                  {title}
                </span>

                {description && (
                  <span className="line-clamp-2 pt-1 text-muted-foreground text-sm leading-snug">
                    {description}
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
