"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Disclosure } from "../_components/disclosure";
import { LIST_GROUP_CLASS, ListGroup } from "../_components/list-group";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { type IndexGroup, PREVIEW_ROWS, getIndexLayout } from "./_utils/mind-maps-page";

type Row = { key: string; node: React.ReactNode };

function Rows({ label, rows }: { label?: string; rows: readonly Row[] }) {
  return (
    <ul aria-label={label} className={LIST_GROUP_CLASS}>
      {rows.map((row) => (
        <li key={row.key}>{row.node}</li>
      ))}
    </ul>
  );
}

/** Keeps the subject the page lands on clear of the page bar. */
const LANDING_CLASS = "scroll-mt-24";

function SubjectSection({
  group,
  ref,
}: {
  group: IndexGroup<Row> & { name: string };
  ref?: React.Ref<HTMLElement>;
}) {
  const titleId = useId();

  return (
    <PageSection aria-labelledby={titleId} className={cn(LANDING_CLASS, "gap-0")} ref={ref}>
      <PageSectionHeader>
        <PageSectionTitle id={titleId}>{group.name}</PageSectionTitle>
        <PageSectionDetail>{group.rows.length}</PageSectionDetail>
      </PageSectionHeader>
      <Rows rows={group.rows} />
    </PageSection>
  );
}

function PreviewRows({ label, rows }: { label: string; rows: readonly Row[] }) {
  const t = useExtracted();
  const [showsAll, setShowsAll] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <Rows label={label} rows={showsAll ? rows : rows.slice(0, PREVIEW_ROWS)} />

      {!showsAll && (
        <Button
          className="self-start"
          onClick={() => setShowsAll(true)}
          size="sm"
          variant="outline"
        >
          {t("Show all {count, number}", { count: rows.length })}
        </Button>
      )}
    </div>
  );
}

/**
 * A list that stays a page long however many maps there are: every row while there are few, then
 * each subject folded to its name, or the first rows with the rest on demand.
 */
export function MindMapIndex({
  groups,
  label,
  opensAt,
}: {
  groups: readonly IndexGroup<Row>[];
  /** Names the list when the goal has no subjects to name its parts. */
  label: string;
  /** The subject the page was opened from, which starts unfolded. */
  opensAt: string | null;
}) {
  const layout = getIndexLayout(groups);
  const rows = groups.flatMap((group) => group.rows);
  const landing = useRef<HTMLDivElement>(null);

  // After mount, so the router's own scroll for the navigation has already run.
  useEffect(() => {
    landing.current?.scrollIntoView({ block: "start" });
  }, []);

  const landingRef = (group: IndexGroup<Row>) => (group.key === opensAt ? landing : undefined);

  if (layout === "preview") {
    return <PreviewRows label={label} rows={rows} />;
  }

  if (layout === "folded") {
    return (
      <ListGroup data-slot="mind-map-subjects">
        {groups.map((group) => (
          <Disclosure
            aside={group.rows.length}
            className={LANDING_CLASS}
            defaultOpen={group.key === opensAt}
            icon={null}
            key={group.key}
            ref={landingRef(group)}
            title={group.name ?? label}
          >
            <Rows rows={group.rows} />
          </Disclosure>
        ))}
      </ListGroup>
    );
  }

  return groups.map((group) =>
    group.name === null ? (
      <Rows key={group.key} label={label} rows={group.rows} />
    ) : (
      <SubjectSection
        group={{ ...group, name: group.name }}
        key={group.key}
        ref={landingRef(group)}
      />
    ),
  );
}
