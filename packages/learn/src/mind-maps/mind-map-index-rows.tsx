"use client";

import { type SavedMindMapView } from "@zoonk/core/mind-maps/contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { NetworkIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { KindIcon } from "../_components/kind-tile";
import {
  LIST_ROW_CLASS,
  LIST_ROW_INTERACTIVE_CLASS,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { LearnLink } from "../learn-link";
import { buildStudyHref } from "./_utils/mind-map-urls";
import { type MindMapsPage, type MindMapsPageChapter } from "./_utils/mind-maps-page";
import { MindMapSaveButton, SavedBookmarkIcon, SavedLabel } from "./mind-map-save-button";
import { MindMapSlot } from "./mind-map-slot";

const LEADING_CLASS = "py-2";

/** A chapter's map in the list: it opens the deck on that map. */
export function ChapterMapRow({ chapter, study }: { chapter: MindMapsPageChapter; study: string }) {
  const t = useExtracted();
  const number = t("Chapter {number, number}", { number: chapter.position });

  return (
    <ListRowLink
      href={buildStudyHref({ place: { chapterId: chapter.chapterId }, study, view: "chapters" })}
      prefetch="intent"
    >
      <ListRowLeading className={LEADING_CLASS}>
        <MindMapSlot thumbnailUrl={chapter.thumbnailUrl}>
          <KindIcon kind="mindMap" />
        </MindMapSlot>
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{chapter.title}</ListRowTitle>
        <ListRowDescription>
          {chapter.thumbnailUrl ? number : `${number} · ${t("As text")}`}
        </ListRowDescription>
      </ListRowContent>
      {chapter.saved && (
        <ListRowTrailing>
          <SavedBookmarkIcon className="size-4" saved />
          <span className="sr-only">
            <SavedLabel />
          </span>
        </ListRowTrailing>
      )}
    </ListRowLink>
  );
}

export type LessonGroupRowData = MindMapsPage["lessonGroups"][number] &
  Pick<MindMapsPageChapter, "position" | "subject" | "title">;

/** A chapter's lesson maps in one row, which opens the Lessons deck on that chapter. */
export function LessonGroupRow({ group, study }: { group: LessonGroupRowData; study: string }) {
  const t = useExtracted();

  const facts = [
    t("Chapter {number, number}", { number: group.position }),
    t("{count, plural, one {# lesson map} other {# lesson maps}}", { count: group.count }),
  ];

  return (
    <ListRowLink
      href={buildStudyHref({ place: { chapterId: group.chapterId }, study, view: "lessons" })}
      prefetch="intent"
    >
      <ListRowContent>
        <ListRowTitle>{group.title}</ListRowTitle>
        <ListRowDescription>{facts.join(" · ")}</ListRowDescription>
      </ListRowContent>
    </ListRowLink>
  );
}

function useSavedKindLabel(kind: SavedMindMapView["kind"]): string {
  const t = useExtracted();

  return kind === "chapter"
    ? t({ description: "A kind of mind map: one for a whole chapter.", message: "Chapter map" })
    : t({
        description: "A small diagram of one lesson's main ideas. Not the chapter's mind map.",
        message: "Lesson map",
      });
}

export type SavedMapRowData = SavedMindMapView & Pick<MindMapsPageChapter, "thumbnailUrl">;

/**
 * A saved map: it opens the Saved deck on that map, and its bookmark removes it. It says its kind,
 * not its chapter's number: the list has no subject headers, so two subjects' "Chapter 1" would
 * read alike.
 */
export function SavedMapRow({
  onRemove,
  saved,
  study,
}: {
  onRemove: () => void;
  saved: SavedMapRowData;
  study: string;
}) {
  const kind = useSavedKindLabel(saved.kind);
  const isChapter = saved.kind === "chapter";

  const place = saved.chapterId && {
    chapterId: saved.chapterId,
    lessonId: isChapter ? null : saved.targetId,
  };

  return (
    <div className="flex items-center gap-1" data-slot="saved-map-row">
      <LearnLink
        className={cn(LIST_ROW_INTERACTIVE_CLASS, "min-w-0 flex-1")}
        href={buildStudyHref({ place: place || null, study, view: "saved" })}
        prefetch="intent"
      >
        <ListRowLeading className={LEADING_CLASS}>
          {isChapter ? (
            <MindMapSlot thumbnailUrl={saved.thumbnailUrl}>
              <KindIcon kind="mindMap" />
            </MindMapSlot>
          ) : (
            <MindMapSlot filled thumbnailUrl={null}>
              <NetworkIcon className="text-muted-foreground size-4" />
            </MindMapSlot>
          )}
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle>{saved.title}</ListRowTitle>
          <ListRowDescription>{kind}</ListRowDescription>
        </ListRowContent>
      </LearnLink>

      <MindMapSaveButton
        edge="end"
        labelled={false}
        onToggle={onRemove}
        saved
        size="icon-lg"
        variant="ghost"
      />
    </div>
  );
}

/** A save whose map can no longer open here keeps the title it had, and can only be removed. */
export function UnavailableMapRow({
  onRemove,
  saved,
}: {
  onRemove: () => void;
  saved: SavedMindMapView;
}) {
  const t = useExtracted();
  const kind = useSavedKindLabel(saved.kind);

  return (
    <div className={cn(LIST_ROW_CLASS, "items-center")} data-slot="unavailable-map-row">
      <ListRowContent>
        <ListRowTitle>{saved.title}</ListRowTitle>
        <ListRowDescription>{kind}</ListRowDescription>
      </ListRowContent>
      <Button onClick={onRemove} size="sm" variant="outline">
        {t("Remove")}
      </Button>
    </div>
  );
}
