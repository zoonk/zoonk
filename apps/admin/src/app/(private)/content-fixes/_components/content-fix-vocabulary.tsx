import { isDeepStrictEqual } from "node:util";
import { ContentAnswer } from "@/components/content-words";
import { FACT_SEPARATOR } from "@zoonk/utils/facts";
import { VocabularyClip } from "./content-fix-media-item";
import { type ScreenMedia } from "./content-fix-screen-row";
import { NO_NAMES, ValueChange } from "./content-fix-values";
import { type ScreenSnapshot, type StoredScreens } from "./screen-list";

type Row = { audioUrl: string | null; id: string; text: string; translation: string };
type Status = "changed" | "new" | "removed" | "unchanged";
type Kind = "sentences" | "words";
type Shown = { label: string; value: string | string[] | null };

const TITLES: Record<Kind, string> = { sentences: "Sentences", words: "Words" };

function rowsOf(kind: Kind, snapshot: ScreenSnapshot): Row[] {
  return kind === "words"
    ? snapshot.words.map((row) => ({ ...row, text: row.word }))
    : snapshot.sentences.map((row) => ({ ...row, text: row.sentence }));
}

/** What a lesson says about one of its words or sentences, in the order a reviewer reads it. */
function fieldsOf(kind: Kind, snapshot: ScreenSnapshot, id: string): Shown[] {
  if (kind === "words") {
    const row = snapshot.words.find((word) => word.id === id);

    return row
      ? [
          { label: "Translation", value: row.translation },
          { label: "Wrong options", value: row.distractors },
          { label: "Note", value: row.note },
        ]
      : [];
  }

  const row = snapshot.sentences.find((sentence) => sentence.id === id);

  return row
    ? [
        { label: "Translation", value: row.translation },
        { label: "Why it means that", value: row.explanation },
        { label: "Wrong options", value: row.distractors },
        { label: "Wrong options in the translation", value: row.translationDistractors },
        { label: "Other word orders accepted", value: row.otherSentenceOrders },
        {
          label: "Other word orders accepted in the translation",
          value: row.otherTranslationOrders,
        },
      ]
    : [];
}

/** A sentence can hold a comma, so a list of sentences is set apart with the facts' dot. */
function inWords(kind: Kind, value: string | string[] | null): string | null {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(kind === "sentences" ? FACT_SEPARATOR : ", ") : null;
  }

  return value || null;
}

const STATUS_WORDS: Record<Status, { className: string; word: string }> = {
  changed: { className: "text-foreground font-medium", word: "Changed in this lesson" },
  new: { className: "text-success-text font-medium", word: "New in this lesson" },
  removed: { className: "text-destructive-text font-medium", word: "Removed from this lesson" },
  unchanged: { className: "text-muted-foreground", word: "Unchanged" },
};

function RowName({ lang, row, status }: { lang?: string; row: Row; status: Status }) {
  const { className, word } = STATUS_WORDS[status];

  return (
    <span className="flex items-baseline justify-between gap-4">
      <span>
        <span className="font-medium" lang={lang}>
          {row.text}
        </span>
        {row.translation && row.translation !== row.text ? (
          <span className="text-muted-foreground">
            {FACT_SEPARATOR}
            {row.translation}
          </span>
        ) : null}
      </span>
      <span className={`shrink-0 text-xs ${className}`}>{word}</span>
    </span>
  );
}

function VocabularyRow({
  change,
  kind,
  lang,
  media,
  row,
  status,
}: {
  change: StoredScreens;
  kind: Kind;
  lang?: string;
  media: ScreenMedia;
  row: Row;
  status: Status;
}) {
  if (status === "unchanged" || status === "removed") {
    return (
      <li className="py-3 text-sm">
        <RowName lang={lang} row={row} status={status} />
      </li>
    );
  }

  const link = change.mediaLinks?.find((entry) => "id" in entry && entry.id === row.id);
  const after = fieldsOf(kind, change.after, row.id);
  const before = fieldsOf(kind, change.before, row.id);

  return (
    <li className="flex flex-col gap-2 py-3 text-sm leading-6">
      <RowName lang={lang} row={row} status={status} />

      {status === "new" ? (
        after.slice(1).map((field) => (
          <ContentAnswer key={field.label} label={field.label}>
            {inWords(kind, field.value) ?? (field.label.startsWith("Other") ? "None" : null)}
          </ContentAnswer>
        ))
      ) : (
        <ul className="divide-y">
          {after.map((field, index) =>
            isDeepStrictEqual(field.value, before[index]?.value) ? null : (
              <ValueChange
                after={inWords(kind, field.value) ?? undefined}
                before={inWords(kind, before[index]?.value ?? null) ?? undefined}
                key={field.label}
                label={field.label}
                names={NO_NAMES}
              />
            ),
          )}
        </ul>
      )}

      <VocabularyClip
        audioUrl={row.audioUrl}
        item={link ? media.get(link.key) : undefined}
        text={row.text}
      />
    </li>
  );
}

function statusOf({ after, before }: { after?: Row; before?: Row }, changed: boolean): Status {
  if (!before) {
    return "new";
  }

  if (!after) {
    return "removed";
  }

  return changed ? "changed" : "unchanged";
}

function VocabularyList({
  change,
  kind,
  lang,
  media,
}: {
  change: StoredScreens;
  kind: Kind;
  lang?: string;
  media: ScreenMedia;
}) {
  const before = rowsOf(kind, change.before);
  const after = rowsOf(kind, change.after);

  const shown = [
    ...after.map((row) => ({ after: row, before: before.find(({ id }) => id === row.id), row })),
    ...before
      .filter(({ id }) => !after.some((row) => row.id === id))
      .map((row) => ({ after: undefined, before: row, row })),
  ].map((entry) => ({
    ...entry,
    status: statusOf(
      entry,
      !isDeepStrictEqual(
        fieldsOf(kind, change.before, entry.row.id),
        fieldsOf(kind, change.after, entry.row.id),
      ),
    ),
  }));

  if (shown.every(({ status }) => status === "unchanged")) {
    return null;
  }

  const counts = (["new", "changed", "removed", "unchanged"] as const)
    .map((status) => [status, shown.filter((entry) => entry.status === status).length] as const)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${String(count)} ${status}`)
    .join(FACT_SEPARATOR);

  return (
    <li className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">{TITLES[kind]}</h3>
      <p className="text-muted-foreground text-xs">{counts}</p>
      <ul className="divide-y">
        {shown.map(({ row, status }) => (
          <VocabularyRow
            change={change}
            key={row.id}
            kind={kind}
            lang={lang}
            media={media}
            row={row}
            status={status}
          />
        ))}
      </ul>
    </li>
  );
}

/** The lesson's words and sentences, when the fix adds, changes or drops one. */
export function VocabularyChanges({
  change,
  lang,
  media,
}: {
  change: StoredScreens;
  lang?: string;
  media: ScreenMedia;
}) {
  return (
    <>
      <VocabularyList change={change} kind="words" lang={lang} media={media} />
      <VocabularyList change={change} kind="sentences" lang={lang} media={media} />
    </>
  );
}
