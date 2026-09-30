"use client";

/** A finished lesson's summary card: its title and every idea in one sentence. */
type SummaryCard = { ideas: string[]; lessonId: string; title: string };

/** Lesson summary cards, on paper in Fun, as Content and chapter pages list them. */
export function SummaryCardList({ summaries }: { summaries: readonly SummaryCard[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {summaries.map((summary) => (
        <li
          className="bg-card ring-foreground/10 in-data-[mode=fun]:fun-paper flex flex-col gap-2 rounded-2xl p-4 ring-1"
          key={summary.lessonId}
        >
          <h3 className="font-medium">{summary.title}</h3>
          <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5 text-sm">
            {summary.ideas.map((idea) => (
              <li key={idea}>{idea}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
