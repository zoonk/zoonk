import { textOf } from "@/components/content-words";
import { ScreenWords, screenKindLabel } from "@/components/screen-words";
import { StateMark } from "@/components/state-mark";
import { formatCount, toWords } from "@/lib/format";
import { LINK_CLASS } from "@/lib/link-class";
import { cn } from "@zoonk/ui/lib/utils";
import { FACT_SEPARATOR } from "@zoonk/utils/facts";
import { isJsonObject } from "@zoonk/utils/json";
import Link from "next/link";
import { type readMapIdeas } from "./content-fix-map";
import { ScreenMarks } from "./content-fix-marks";
import { type MediaItem, ReviewClip, ScreenPicture } from "./content-fix-media-item";
import {
  type ScreenRow,
  type ScreenSnapshot,
  type SnapshotScreen,
  type StoredScreens,
} from "./screen-list";

export type ScreenMedia = ReadonlyMap<string, MediaItem>;

export type ScreenContext = {
  change: StoredScreens;
  ideas: ReturnType<typeof readMapIdeas>;
  lang?: string;
  media: ScreenMedia;
};

type ChangedRow = Extract<ScreenRow, { status: "changed" }>;

export const NUMBER_CLASS = "text-muted-foreground font-mono text-xs leading-5 tabular-nums";
export const ROW_CLASS = "grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2";

function vocabularyOf(snapshot: ScreenSnapshot, screen: SnapshotScreen) {
  const word = snapshot.words.find(({ id }) => id === screen.wordId);
  const sentence = snapshot.sentences.find(({ id }) => id === screen.sentenceId);

  return {
    sentence: sentence?.sentence,
    translation: word?.translation ?? sentence?.translation,
    word: word?.word,
  };
}

export function screenHeadline({
  ideas,
  screen,
  snapshot,
}: {
  ideas: number;
  screen: SnapshotScreen;
  snapshot: ScreenSnapshot;
}): string {
  const { sentence, translation, word } = vocabularyOf(snapshot, screen);
  const content = isJsonObject(screen.content) ? screen.content : {};

  if (word) {
    return screen.kind === "translation" && translation
      ? `${translation} → ${word}`
      : [word, translation].filter(Boolean).join(FACT_SEPARATOR);
  }

  if (screen.kind === "summary" && ideas > 0) {
    return formatCount(ideas, "idea");
  }

  return (
    sentence ??
    textOf(content.title) ??
    textOf(content.symbol) ??
    textOf(content.question) ??
    textOf(content.text) ??
    textOf(content.problem) ??
    textOf(content.statement) ??
    textOf(content.prompt) ??
    textOf(content.template)?.replaceAll("[BLANK]", "____") ??
    textOf(content.mission) ??
    ""
  );
}

function ScreenAttachments({
  context,
  proposed,
  screen,
}: {
  context: ScreenContext;
  proposed?: boolean;
  screen: SnapshotScreen;
}) {
  const links = proposed ? context.change.mediaLinks : undefined;

  const picture = links?.find(
    (link) => link.target === "picture" && link.position === screen.position,
  );

  const clip = links?.find(
    (link) => link.target === "alphabet" && link.position === screen.position,
  );

  const pictureItem = picture ? context.media.get(picture.key) : undefined;
  const clipItem = clip ? context.media.get(clip.key) : undefined;

  return (
    <>
      {pictureItem ? <ScreenPicture item={pictureItem} /> : null}
      {!pictureItem && screen.mediaAssetId ? (
        <Link className={cn(LINK_CLASS, "w-fit text-xs")} href={`/media/${screen.mediaAssetId}`}>
          See the picture
        </Link>
      ) : null}
      {screen.kind === "alphabet" && (
        <ReviewClip
          audioUrl={textOf(screen.content.audioUrl)}
          item={clipItem}
          text={textOf(screen.content.audioText) ?? ""}
        />
      )}
    </>
  );
}

function ScreenBody({
  className = "max-w-prose",
  context,
  proposed,
  screen,
  snapshot,
  variant,
}: {
  className?: string;
  context: ScreenContext;
  proposed?: boolean;
  screen: SnapshotScreen;
  snapshot: ScreenSnapshot;
  variant?: SnapshotScreen["variants"][number];
}) {
  return (
    <div className={cn("flex flex-col gap-3 text-sm leading-6", className)}>
      <ScreenWords
        content={variant ? variant.content : screen.content}
        kind={screen.kind}
        lang={context.lang}
        {...vocabularyOf(snapshot, screen)}
      />
      {!variant && <ScreenAttachments context={context} proposed={proposed} screen={screen} />}
    </div>
  );
}

function RowHeader({
  screen,
  status,
  tone,
}: {
  screen: SnapshotScreen;
  status: string;
  tone: "added" | "plain" | "removed";
}) {
  return (
    <span className="text-muted-foreground text-xs leading-5 font-medium">
      {screenKindLabel(screen)}
      {FACT_SEPARATOR}
      <span
        className={cn(
          "font-medium",
          tone === "added" && "text-success-text",
          tone === "removed" && "text-destructive-text",
          tone === "plain" && "text-foreground",
        )}
      >
        {status}
      </span>
    </span>
  );
}

function ScreenComparison({
  context,
  row,
  variant,
}: {
  context: ScreenContext;
  row: ChangedRow;
  variant?: ChangedRow["variants"][number];
}) {
  const { after, before } = context.change;

  const sides = [
    { label: "Before", screen: row.before, snapshot: before, variant: variant?.before },
    {
      label: "After",
      proposed: true,
      screen: row.screen,
      snapshot: after,
      variant: variant?.after,
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {sides.map(({ label, ...body }) => (
        <div className="flex min-w-0 flex-col gap-1" key={label}>
          <span className="text-muted-foreground text-xs">{label}</span>
          <ScreenBody className="flex-1 rounded-lg border px-3 py-2" context={context} {...body} />
        </div>
      ))}
    </div>
  );
}

function RowFrame({
  children,
  position,
  screen,
  status,
  tone,
}: {
  children: React.ReactNode;
  position: number | null;
  screen: SnapshotScreen;
  status: string;
  tone: "added" | "plain" | "removed";
}) {
  return (
    <li className={cn(ROW_CLASS, "py-4")}>
      <span className={NUMBER_CLASS}>{position}</span>
      <div className="flex min-w-0 flex-col gap-2">
        <RowHeader screen={screen} status={status} tone={tone} />
        {children}
      </div>
    </li>
  );
}

export function ShownRow({
  context,
  row,
}: {
  context: ScreenContext;
  row: Exclude<ScreenRow, { status: "unchanged" }>;
}) {
  const { after, before } = context.change;

  switch (row.status) {
    case "new":
      return (
        <RowFrame position={row.position} screen={row.screen} status="New" tone="added">
          <ScreenBody context={context} proposed screen={row.screen} snapshot={after} />
          <ScreenMarks context={context} screen={row.screen} />
        </RowFrame>
      );
    case "removed":
      return (
        <RowFrame
          position={null}
          screen={row.screen}
          status={`Removed, was ${String(row.was)}`}
          tone="removed"
        >
          <ScreenBody
            className="text-muted-foreground max-w-prose"
            context={context}
            screen={row.screen}
            snapshot={before}
          />
        </RowFrame>
      );
    case "moved":
      return (
        <RowFrame
          position={row.position}
          screen={row.screen}
          status={`Moved, was ${String(row.was)}`}
          tone="plain"
        >
          <p className="max-w-prose text-sm leading-6">
            {screenHeadline({ ideas: context.ideas.length, screen: row.screen, snapshot: after })}
          </p>
        </RowFrame>
      );
    case "changed":
      return (
        <RowFrame
          position={row.position}
          screen={row.screen}
          status={row.was === null ? "Changed" : `Changed, was ${String(row.was)}`}
          tone="plain"
        >
          {row.answerKey && (
            <StateMark className="text-xs" state="answerKey" tone="attention">
              Changes the right answer
            </StateMark>
          )}
          {row.baseChanged && <ScreenComparison context={context} row={row} />}
          {!row.baseChanged && row.variants.length === 0 && (
            <ScreenBody context={context} proposed screen={row.screen} snapshot={after} />
          )}
          {row.variants.map((edit) => (
            <div className="flex flex-col gap-1" key={edit.after.id}>
              <p className="text-muted-foreground text-xs leading-5 font-medium">
                {`${toWords(edit.after.kind)} version${FACT_SEPARATOR}${edit.after.key}`}
              </p>
              <ScreenComparison context={context} row={row} variant={edit} />
            </div>
          ))}
          <ScreenMarks context={context} screen={row.screen} />
        </RowFrame>
      );
    default:
      return row satisfies never;
  }
}
