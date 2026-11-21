import { readSavedLessonMap } from "@zoonk/core/library/lessons/map";
import { cn } from "@zoonk/ui/lib/utils";
import { FACT_SEPARATOR } from "@zoonk/utils/facts";
import { IdeaIcon } from "./content-fix-media-item";
import { type ScreenContext } from "./content-fix-screen-row";
import { SIDES } from "./content-fix-values";
import { type ScreenRow, type StoredScreens, ideaIndexOf, ideaSources } from "./screen-list";

type IdeaStatus = "new" | "removed" | "reworded" | "same";
type Idea = { label?: string; text: string };

type MapIdea = Idea & {
  before: (Idea & { index: number }) | null;
  index: number;
  status: IdeaStatus;
};

export function readMapIdeas(change: StoredScreens): MapIdea[] {
  const ideas = readSavedLessonMap(change.after.summary)?.ideas ?? [];
  const old = readSavedLessonMap(change.before.summary)?.ideas ?? [];
  const sources = ideaSources(change);

  return ideas.map((idea, index) => {
    const from = sources[index] ?? null;
    const previous = from === null ? undefined : old[from];

    if (from === null || !previous) {
      return { ...idea, before: null, index, status: "new" };
    }

    return {
      ...idea,
      before: { ...previous, index: from },
      index,
      status: previous.text === idea.text && previous.label === idea.label ? "same" : "reworded",
    };
  });
}

function removedIdeas(change: StoredScreens) {
  const sources = new Set(ideaSources(change));
  const old = readSavedLessonMap(change.before.summary)?.ideas ?? [];

  return old.flatMap((idea, index) => (sources.has(index) ? [] : [{ ...idea, index }]));
}

/** Screens a learner meets this idea on now: new screens, and kept ones newly marked with it. */
function ideaScreens(rows: readonly ScreenRow[], index: number) {
  return rows.flatMap((row) => {
    if (row.status === "removed" || ideaIndexOf(row.screen) !== index) {
      return [];
    }

    const marked =
      row.status === "new" ||
      (row.status === "changed" && ideaIndexOf(row.before) !== ideaIndexOf(row.screen));

    return [{ marked, position: row.position }];
  });
}

function ScreenNumbers({ screens }: { screens: { marked: boolean; position: number }[] }) {
  if (screens.length === 0) {
    return null;
  }

  return (
    <>
      {screens.length === 1 ? "Screen " : "Screens "}
      {screens.map(({ marked, position }, index) => (
        <span key={position}>
          {index > 0 && ", "}
          <span className={cn(marked && "text-success-text")}>{position}</span>
        </span>
      ))}
    </>
  );
}

const STATUS_WORDS: Partial<Record<IdeaStatus, { className: string; word: string }>> = {
  new: { className: "text-success-text", word: "New" },
  removed: { className: "text-destructive-text", word: "Removed" },
  reworded: { className: "", word: "Reworded" },
};

function Marked({ side, text }: { side: keyof typeof SIDES; text: string }) {
  return <mark className={cn("text-foreground", SIDES[side].mark)}>{text}</mark>;
}

function ideaWords({ label, text }: Idea) {
  return label && label !== text ? [label, text].join(FACT_SEPARATOR) : text;
}

function IdeaText({ idea }: { idea: MapIdea }) {
  const words = ideaWords(idea);

  switch (idea.status) {
    case "new":
      return <Marked side="after" text={words} />;
    case "removed":
      return <Marked side="before" text={words} />;
    case "reworded":
      return (
        <span className="flex flex-col gap-1">
          <span>{idea.before && <Marked side="before" text={ideaWords(idea.before)} />}</span>
          <span>
            <Marked side="after" text={words} />
          </span>
        </span>
      );
    case "same":
      return words;
    default:
      return idea.status satisfies never;
  }
}

function IdeaRow({
  context,
  idea,
  number,
  screens,
}: {
  context: ScreenContext;
  idea: MapIdea;
  number: number | null;
  screens: { marked: boolean; position: number }[];
}) {
  const from = idea.before?.index;
  const movedFrom = from === undefined || from === idea.index ? null : from + 1;
  const status = STATUS_WORDS[idea.status];

  const icon =
    idea.status === "new" &&
    context.change.mediaLinks?.find(
      (link) => link.target === "idea" && link.position === idea.index,
    );

  const iconItem = icon ? context.media.get(icon.key) : undefined;

  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2 py-3 text-sm leading-6">
      <span className="text-muted-foreground font-mono text-xs leading-6 tabular-nums">
        {number}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex flex-wrap items-baseline justify-between gap-x-4">
          <span className="min-w-0" lang={context.lang}>
            <IdeaText idea={idea} />
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {status && (
              <span className={cn("text-xs font-medium", status.className)}>{status.word}</span>
            )}
            {status && movedFrom !== null && FACT_SEPARATOR}
            {movedFrom !== null && <>Moved from {movedFrom}</>}
            {(status || movedFrom !== null) && screens.length > 0 && FACT_SEPARATOR}
            <ScreenNumbers screens={screens} />
          </span>
        </span>
        {iconItem && (
          <span className="text-muted-foreground mt-2 text-xs">
            <IdeaIcon item={iconItem} />
          </span>
        )}
      </span>
    </li>
  );
}

function headline({ ideas, removed }: { ideas: readonly MapIdea[]; removed: number }) {
  const count = (status: IdeaStatus) => ideas.filter((idea) => idea.status === status).length;
  const reworded = count("reworded");
  const moved = ideas.filter((idea) => idea.before && idea.before.index !== idea.index).length;

  const parts = [
    reworded > 0 && `${String(reworded)} ${reworded === 1 ? "idea" : "ideas"} reworded`,
    count("new") > 0 && `${String(count("new"))} new`,
    moved > 0 && `${String(moved)} moved`,
    removed > 0 && `${String(removed)} removed`,
  ].filter(Boolean);

  return parts.length > 0
    ? parts.join(FACT_SEPARATOR)
    : "The ideas don't change. New screens are marked.";
}

/**
 * The lesson's map: each idea with the screens that teach it, a reworded idea struck through
 * then new, and a new idea with its icon. Shown only when the fix changes an idea or a screen's.
 */
export function ContentFixMap({
  change,
  context,
  rows,
}: {
  change: StoredScreens;
  context: ScreenContext;
  rows: readonly ScreenRow[];
}) {
  const { ideas } = context;
  const removed = removedIdeas(change);
  const shown = ideas.map((idea) => ({ idea, screens: ideaScreens(rows, idea.index) }));

  const changes =
    removed.length > 0 ||
    shown.some(
      ({ idea, screens }) =>
        idea.status !== "same" ||
        (idea.before && idea.before.index !== idea.index) ||
        screens.some(({ marked }) => marked),
    );

  if (!changes) {
    return null;
  }

  return (
    <li className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">Map</h3>
      <p className="text-muted-foreground text-xs">
        {headline({ ideas, removed: removed.length })}
      </p>
      <ol className="divide-y">
        {shown.map(({ idea, screens }) => (
          <IdeaRow
            context={context}
            idea={idea}
            key={idea.index}
            number={idea.index + 1}
            screens={screens}
          />
        ))}
        {removed.map((idea) => (
          <IdeaRow
            context={context}
            idea={{ ...idea, before: null, status: "removed" }}
            key={`removed:${String(idea.index)}`}
            number={idea.index + 1}
            screens={[]}
          />
        ))}
      </ol>
    </li>
  );
}
