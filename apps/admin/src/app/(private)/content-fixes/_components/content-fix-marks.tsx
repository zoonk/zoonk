import { StateMark } from "@/components/state-mark";
import { applyMarkedQuotes } from "@zoonk/core/staff/content-fixes/media-schema";
import { type MediaItem } from "./content-fix-media-item";
import { type ScreenContext } from "./content-fix-screen-row";
import { type SnapshotScreen, ideaIndexOf, quotesOf } from "./screen-list";

function QuoteLine({ label, lang, quote }: { label: string; lang?: string; quote: string | null }) {
  return (
    <p className="text-muted-foreground text-xs whitespace-pre-wrap">
      {label}: {quote ? <span lang={lang}>“{quote}”</span> : <span>none</span>}
    </p>
  );
}

/** The example box and underline a screen shows once the fix applies. */
export function FixMarks({
  index,
  item,
  lang,
  remarked,
}: {
  index: number;
  item?: MediaItem;
  lang?: string;
  remarked: boolean;
}) {
  if (item?.need.kind !== "marks") {
    return null;
  }

  if (item.result === null) {
    return <StateMark state="running">Marking its example box and underline</StateMark>;
  }

  const kept = item.need.kept[index] ?? { example: null, underline: null };

  const marked =
    item.result !== "failed" && item.result.kind === "marks"
      ? item.result.screens[index]
      : undefined;

  const quotes = applyMarkedQuotes({ kept, marked, remarked });
  const framedNothing = remarked && marked?.example === null && kept.example !== null;

  return (
    <div className="flex flex-col gap-1">
      {!marked && (
        <StateMark className="text-xs whitespace-normal" state="failed">
          Couldn&apos;t mark it again, so it keeps what still fits
        </StateMark>
      )}
      {framedNothing && (
        <StateMark className="text-xs whitespace-normal" state="skipped" tone="attention">
          Marking it again framed nothing, so it keeps its example box
        </StateMark>
      )}
      <QuoteLine label="Example box" lang={lang} quote={quotes.example} />
      <QuoteLine label="Underlined" lang={lang} quote={quotes.underline} />
    </div>
  );
}

export function IdeaLine({ context, screen }: { context: ScreenContext; screen: SnapshotScreen }) {
  const index = ideaIndexOf(screen);
  const idea = index === null ? undefined : context.ideas[index];

  if (index === null || !idea) {
    return null;
  }

  return (
    <p className="text-muted-foreground text-xs">
      Idea {index + 1} on the map: <span lang={context.lang}>{idea.text}</span>
      {idea.status === "new" ? " (new)" : null}
    </p>
  );
}

/** The marks a fix prepares for this screen of its new list, if any. */
export function marksLinkOf(context: ScreenContext, screen: SnapshotScreen) {
  const link = context.change.mediaLinks?.find(
    (entry) => entry.target === "marks" && entry.positions.includes(screen.position),
  );

  return link?.target === "marks" ? link : undefined;
}

/**
 * The example box and underline a screen shows: on a fix's side, what marking leaves it with;
 * otherwise its saved quotes. Only a screen with marked text has them.
 */
export function ScreenQuoteLines({
  context,
  proposed,
  screen,
}: {
  context: ScreenContext;
  proposed?: boolean;
  screen: SnapshotScreen;
}) {
  const link = proposed ? marksLinkOf(context, screen) : undefined;

  if (link) {
    return (
      <FixMarks
        index={link.positions.indexOf(screen.position)}
        item={context.media.get(link.key)}
        lang={context.lang}
        remarked={link.remarked?.includes(screen.position) ?? false}
      />
    );
  }

  if (screen.kind !== "explanation" && screen.kind !== "workedExample") {
    return null;
  }

  const { example, underline } = quotesOf(screen);

  return (
    <div className="flex flex-col gap-1">
      <QuoteLine label="Example box" lang={context.lang} quote={example} />
      <QuoteLine label="Underlined" lang={context.lang} quote={underline} />
    </div>
  );
}
