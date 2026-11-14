import { AdminJson } from "@/components/admin-json";
import { AdminSection } from "@/components/admin-section";
import { ContentWords } from "@/components/content-words";
import { DetailField, DetailFields } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { type AdminItem } from "@/data/items/get-item";
import { formatDate, formatDateTime } from "@/lib/format";
import { LINK_CLASS } from "@/lib/link-class";
import Link from "next/link";

const CALIBRATION_DIGITS = 2;
/** How far from an average question counts as easier or harder than most. */
const NOTABLE_DIFFICULTY = 0.5;

function formatCalibration(value: number): string {
  return value.toFixed(CALIBRATION_DIGITS).replace("-", "−");
}

/** The number alone means nothing to most readers, so it comes after what it says. */
function describeDifficulty(difficulty: number | null): string | null {
  if (difficulty === null) {
    return null;
  }

  if (Math.abs(difficulty) < NOTABLE_DIFFICULTY) {
    return `About average (${formatCalibration(difficulty)})`;
  }

  return `${difficulty < 0 ? "Easier" : "Harder"} than most (${formatCalibration(difficulty)})`;
}

export function ItemQuestion({ item }: { item: AdminItem }) {
  return (
    <AdminSection title="What the learner sees">
      <div className="flex max-w-2xl flex-col gap-4 text-sm leading-6">
        <ContentWords content={item.content} />
      </div>
      <AdminJson label="JSON" value={item.content} />
    </AdminSection>
  );
}

export function ItemAbout({ item }: { item: AdminItem }) {
  return (
    <AdminSection title="About">
      <DetailFields>
        <DetailField label="Skill">
          <Link className={LINK_CLASS} href={`/skills/${item.skill.id}`} prefetch>
            {item.skill.name}
          </Link>
        </DetailField>
        <DetailField label="Difficulty">{describeDifficulty(item.difficulty)}</DetailField>
        <DetailField label="Written">{formatDate(item.createdAt)}</DetailField>
      </DetailFields>
    </AdminSection>
  );
}

export function ItemDetails({ item }: { item: AdminItem }) {
  return (
    <AdminSection title="Details">
      <DetailFields>
        <DetailField label="Field">{item.field ?? "General"}</DetailField>
        <DetailField label="Exam">
          {item.examBlueprint ? (
            <Link className={LINK_CLASS} href={`/exams/${item.examBlueprint.id}`} prefetch>
              {item.examBlueprint.name}
            </Link>
          ) : null}
        </DetailField>
        <DetailField label="Source">
          <ItemSource item={item} />
        </DetailField>
        <DetailField label="Tells learners apart">
          {item.discrimination === null ? null : formatCalibration(item.discrimination)}
        </DetailField>
        <DetailField label="Updated">{formatDateTime(item.updatedAt)}</DetailField>
      </DetailFields>
    </AdminSection>
  );
}

export function ItemWrittenBy({ item }: { item: AdminItem }) {
  return (
    <AdminSection title="Written by">
      <ProvenanceFields provenance={item} />
    </AdminSection>
  );
}

/** A private upload's title and citation can be personal data, so only its link is shown. */
function ItemSource({ item }: { item: AdminItem }) {
  if (!item.source) {
    return item.sourceCitation;
  }

  return (
    <span className="flex flex-col gap-0.5">
      <Link className={LINK_CLASS} href={`/sources/${item.source.id}`} prefetch>
        {item.source.title ?? "Private upload"}
      </Link>
      {item.source.title && item.sourceCitation ? (
        <span className="text-muted-foreground text-xs">{item.sourceCitation}</span>
      ) : null}
    </span>
  );
}
