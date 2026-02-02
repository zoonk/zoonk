import { type ActivityForList } from "@/data/activities/list-lesson-activities";
import { Link } from "@/i18n/navigation";
import { type ActivityKindInfo } from "@/lib/activities";
import { getExtracted } from "next-intl/server";
import { ActivityIndicator } from "./activity-indicator";

export async function ActivityList({
  activities,
  baseHref,
  kindMeta,
}: {
  activities: ActivityForList[];
  baseHref: string;
  kindMeta: Map<string, ActivityKindInfo>;
}) {
  const t = await getExtracted();

  if (activities.length === 0) {
    return null;
  }

  return (
    <ul aria-label={t("Activities")} className="flex flex-col gap-1">
      {activities.map((activity) => {
        const meta = kindMeta.get(activity.kind);

        const title = activity.kind === "custom" && activity.title ? activity.title : meta?.label;

        const description =
          activity.kind === "custom" && activity.description
            ? activity.description
            : meta?.description;

        return (
          <li key={String(activity.id)}>
            <Link
              className="hover:bg-muted/30 -mx-3 flex items-start gap-2.5 rounded-lg px-3 py-3 text-left transition-colors"
              href={`${baseHref}/a/${activity.position}`}
            >
              <ActivityIndicator completed={false} />

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-foreground/90 text-sm leading-none font-medium">{title}</span>

                {description && (
                  <span className="text-muted-foreground line-clamp-2 pt-1 text-sm leading-snug">
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
