import { AdminJson } from "@/components/admin-json";
import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { STAT_TILES_CLASS, StatTile } from "@/components/stat-tile";
import { StateMark } from "@/components/state-mark";
import { type AdminPublicSource } from "@/data/sources/get-source";
import { formatDate, formatDateTime } from "@/lib/format";
import { CalendarClockIcon, GraduationCapIcon, ListChecksIcon, UsersIcon } from "lucide-react";

const LINK_CLASS = "hit-area relative underline underline-offset-3 break-all";

/** What depends on the source, and when Zoonk looks at it next. */
export function SourceTotals({ source }: { source: AdminPublicSource }) {
  return (
    <div className={STAT_TILES_CLASS}>
      <StatTile
        detail="Read from it"
        icon={<GraduationCapIcon />}
        title="Exams"
        value={source._count.examBlueprints.toLocaleString("en")}
      />

      <StatTile
        detail="Cite it"
        icon={<ListChecksIcon />}
        title="Practice questions"
        value={source._count.items.toLocaleString("en")}
      />

      <StatTile
        detail="Study from it"
        icon={<UsersIcon />}
        title="Learners"
        value={source._count.learnerSources.toLocaleString("en")}
      />

      <StatTile
        detail={source.validUntil ? `Good until ${formatDate(source.validUntil)}` : "No end date"}
        icon={<CalendarClockIcon />}
        title="Last checked"
        value={
          source.fetchedAt
            ? source.fetchedAt.toLocaleDateString("en", { day: "numeric", month: "short" })
            : "Never"
        }
      />
    </div>
  );
}

export function SourceChecking({ source }: { source: AdminPublicSource }) {
  return (
    <AdminSection title="Checking for changes">
      <DetailFields>
        <DetailField label="Link" mono={false}>
          {source.url ? (
            <a className={LINK_CLASS} href={source.url} rel="noreferrer" target="_blank">
              {source.url}
            </a>
          ) : null}
        </DetailField>
        <DetailField label="Last checked" mono={false}>
          {source.fetchedAt ? formatDateTime(source.fetchedAt) : null}
        </DetailField>
        <DetailField label="Good until" mono={false}>
          {source.validUntil ? formatDateTime(source.validUntil) : "No end date"}
        </DetailField>
        <DetailField label="Next check" mono={false}>
          {source.nextCheckAt ? (
            formatDateTime(source.nextCheckAt)
          ) : (
            <StateMark state="paused">Not being checked</StateMark>
          )}
        </DetailField>
      </DetailFields>
    </AdminSection>
  );
}

/** The words Zoonk kept from the page or file, as a reader would read them. */
export function SourceText({ source }: { source: AdminPublicSource }) {
  const { excerpt, textLength } = source;

  if (!excerpt) {
    return (
      <AdminSection title="What Zoonk read from it">
        <AdminSectionEmpty>No text was read from this source.</AdminSectionEmpty>
      </AdminSection>
    );
  }

  return (
    <AdminSection
      description={
        textLength > excerpt.length
          ? `The first ${excerpt.length.toLocaleString("en")} characters.`
          : undefined
      }
      title={`What Zoonk read from it (${textLength.toLocaleString("en")} characters)`}
    >
      <p className="max-w-2xl text-sm leading-6 whitespace-pre-line">{excerpt}</p>
    </AdminSection>
  );
}

export function SourceDetails({ source }: { source: AdminPublicSource }) {
  return (
    <>
      <AdminSection title="Details">
        <DetailFields>
          <DetailField label="File type">{source.mimeType}</DetailField>
          <DetailField label="Content hash">{source.contentHash}</DetailField>
          <DetailField label="Created" mono={false}>
            {formatDateTime(source.createdAt)}
          </DetailField>
          <DetailField label="Updated" mono={false}>
            {formatDateTime(source.updatedAt)}
          </DetailField>
        </DetailFields>
      </AdminSection>

      <AdminSection title="As stored">
        <div className="flex flex-col">
          <AdminJson label="Reuse policy" value={source.reusePolicy} />
          <AdminJson label="Structure" value={source.structure} />
        </div>
      </AdminSection>
    </>
  );
}
