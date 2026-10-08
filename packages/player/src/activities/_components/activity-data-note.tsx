"use client";

import {
  type ActivityStepContent,
  showsActivityData,
} from "@zoonk/core/library/activities/templates";
import { useExtracted } from "next-intl";

/**
 * Where the activity's numbers come from: a cited source, or a plain note that the data is an
 * example, so made-up numbers never pass as facts. An activity that shows no data (sorting,
 * matching) has no note, even when its content carries one.
 */
export function ActivityDataNote({
  content,
}: {
  content: Pick<ActivityStepContent, "data" | "template">;
}) {
  const t = useExtracted();
  const { data } = content;

  if (!data || !showsActivityData(content.template)) {
    return null;
  }

  if ("isExample" in data) {
    return (
      <p className="text-muted-foreground text-xs" data-slot="activity-data-note">
        {t("Example numbers, not real data")}
      </p>
    );
  }

  const { publisher, title, url, year } = data.source;
  const details = [publisher, year === undefined ? null : String(year)].filter(Boolean).join(", ");
  const name = details ? `${title} (${details})` : title;

  return (
    <p className="text-muted-foreground text-xs" data-slot="activity-data-note">
      {t("Source:")}{" "}
      {url ? (
        <a className="underline underline-offset-2" href={url} rel="noreferrer" target="_blank">
          {name}
        </a>
      ) : (
        name
      )}
    </p>
  );
}
