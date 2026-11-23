import { StateMark } from "@/components/state-mark";
import { type MediaItem } from "./content-fix-media-item";
import { type ScreenContext } from "./content-fix-screen-row";
import { type SnapshotScreen, ideaIndexOf } from "./screen-list";

function QuoteLine({ label, lang, quote }: { label: string; lang?: string; quote: string | null }) {
  return (
    <p className="text-muted-foreground text-xs whitespace-pre-wrap">
      {label}: {quote ? <span lang={lang}>“{quote}”</span> : <span>none</span>}
    </p>
  );
}

/**
 * The example box and underline a screen shows once the fix applies: the quotes that still fit,
 * with the ones it lacked marked at proposal.
 */
export function FixMarks({
  index,
  item,
  lang,
}: {
  index: number;
  item?: MediaItem;
  lang?: string;
}) {
  if (item?.need.kind !== "marks") {
    return null;
  }

  if (item.result === null) {
    return <StateMark state="running">Marking its example box and underline</StateMark>;
  }

  const kept = item.need.kept[index];

  const marked =
    item.result !== "failed" && item.result.kind === "marks"
      ? item.result.screens[index]
      : undefined;

  return (
    <div className="flex flex-col gap-1">
      {!marked && (
        <StateMark className="text-xs" state="failed">
          Couldn&apos;t mark it again, so it keeps what still fits
        </StateMark>
      )}
      <QuoteLine label="Example box" lang={lang} quote={kept?.example ?? marked?.example ?? null} />
      <QuoteLine
        label="Underlined"
        lang={lang}
        quote={kept?.underline ?? marked?.underline ?? null}
      />
    </div>
  );
}

function IdeaLine({ context, screen }: { context: ScreenContext; screen: SnapshotScreen }) {
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

/** A proposed screen's marks: the idea it teaches, and its example box and underline. */
export function ScreenMarks({
  context,
  screen,
}: {
  context: ScreenContext;
  screen: SnapshotScreen;
}) {
  const link = context.change.mediaLinks?.find(
    (entry) => entry.target === "marks" && entry.positions.includes(screen.position),
  );

  return (
    <>
      <IdeaLine context={context} screen={screen} />
      {link?.target === "marks" && (
        <FixMarks
          index={link.positions.indexOf(screen.position)}
          item={context.media.get(link.key)}
          lang={context.lang}
        />
      )}
    </>
  );
}
