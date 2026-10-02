"use client";

import { type ActivityStepContent } from "@zoonk/core/library/activities/templates";
import { useExtracted } from "next-intl";

/**
 * Where the activity's numbers come from: a cited source, or a plain note that the data is an
 * example, so made-up numbers never pass as facts.
 */
export function ActivityDataNote({ data }: { data: ActivityStepContent["data"] }) {
  const t = useExtracted();

  if (!data) {
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
