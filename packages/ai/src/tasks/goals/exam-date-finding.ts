const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const MAX_LABEL_LENGTH = 60;
const MAX_TITLE_LENGTH = 200;

type RawExamDate = { date: string; label: string };

export type RawExamDateFinding = {
  dates: RawExamDate[];
  sourceTitle: string | null;
  sourceUrl: string | null;
  status: "notPublished" | "official" | "unknown";
};

export type ExamDateFinding =
  | { dates: RawExamDate[]; source: { title: string | null; url: string }; status: "official" }
  | { dates: []; source: null; status: "notPublished" | "unknown" };

const UNKNOWN: ExamDateFinding = { dates: [], source: null, status: "unknown" };

function isRealDate(date: string): boolean {
  return ISO_DATE_PATTERN.test(date) && !Number.isNaN(Date.parse(date));
}

function cleanDates({ dates, today }: { dates: RawExamDate[]; today: string }): RawExamDate[] {
  const ahead = dates
    .filter((day) => isRealDate(day.date) && day.date >= today)
    .map((day) => ({ date: day.date, label: day.label.trim().slice(0, MAX_LABEL_LENGTH) }))
    .toSorted((a, b) => a.date.localeCompare(b.date));

  return ahead.filter(
    (day, index) => ahead.findIndex((other) => other.date === day.date) === index,
  );
}

/** Anything but an official day ahead, from a page a search returned, reads as not known yet. */
export function toExamDateFinding({
  isSearched,
  raw,
  today,
}: {
  /** An address on a site the search didn't return was invented. */
  isSearched: (url: string) => boolean;
  raw: RawExamDateFinding;
  today: string;
}): ExamDateFinding {
  if (raw.status !== "official") {
    return { dates: [], source: null, status: raw.status };
  }

  const dates = cleanDates({ dates: raw.dates, today });
  const url = raw.sourceUrl?.trim();

  if (dates.length === 0 || !url || !URL.canParse(url) || !isSearched(url)) {
    return UNKNOWN;
  }

  const title = raw.sourceTitle?.trim().slice(0, MAX_TITLE_LENGTH) || null;

  return { dates, source: { title, url }, status: "official" };
}
