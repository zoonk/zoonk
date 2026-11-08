"use client";

import { type ChapterMindMapView } from "@zoonk/core/mind-maps/contract";
import { type FinishedChapter } from "@zoonk/core/sessions/completion-contract";
import { Button } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { useExtracted } from "next-intl";
import { type ComponentType, createContext, use, useEffect, useId, useState } from "react";
import {
  LIST_ROW_CLASS,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowTitle,
} from "../_components/list-group";
import { PageSectionLabel } from "../_components/page";
import { type MindMapActions } from "./mind-map-actions";
import { MindMapRow } from "./mind-map-row";

type FinishedChapterMapProps = { chapter: FinishedChapter };

const FinishedChapterMapContext = createContext<ComponentType<FinishedChapterMapProps> | null>(
  null,
);

/** Pass a component defined at module level; screens without one show no map at a chapter's end. */
export function FinishedChapterMapProvider({
  children,
  map,
}: {
  children: React.ReactNode;
  map: ComponentType<FinishedChapterMapProps>;
}) {
  return <FinishedChapterMapContext value={map}>{children}</FinishedChapterMapContext>;
}

/** After the day's moment and before "Up next", when the completion finished a chapter. */
export function FinishedChapterMoment({ chapter }: { chapter: FinishedChapter | null }) {
  const ChapterMap = use(FinishedChapterMapContext);

  if (!chapter || !ChapterMap) {
    return null;
  }

  // oxlint-disable-next-line react/static-components -- The host supplies a stable module-level component through context; nothing is created here.
  return <ChapterMap chapter={chapter} />;
}

function Unreachable({ onRetry, title }: { onRetry: () => void; title: string }) {
  const t = useExtracted();

  return (
    <div className={LIST_ROW_CLASS}>
      <ListRowContent>
        <ListRowTitle>{title}</ListRowTitle>
        <ListRowDescription>
          {t("We couldn't reach the server. Check your connection.")}
        </ListRowDescription>
      </ListRowContent>
      <Button className="self-center" onClick={onRetry} size="sm" variant="outline">
        {t("Try again")}
      </Button>
    </div>
  );
}

function RowSkeleton({ title }: { title: string }) {
  return (
    <div aria-busy="true" className={LIST_ROW_CLASS}>
      <ListRowLeading className="py-2">
        <Skeleton className="size-12 rounded-lg" />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{title}</ListRowTitle>
        <span className="flex h-4 items-center">
          <Skeleton className="h-3 w-28 rounded-sm" />
        </span>
      </ListRowContent>
    </div>
  );
}

type FinishedChapterMapInput = { actions: MindMapActions; chapter: FinishedChapter; plus: boolean };

function ReadChapterMap({
  actions,
  chapter,
  onRetry,
  plus,
}: FinishedChapterMapInput & { onRetry: () => void }) {
  const t = useExtracted();
  const labelId = useId();
  const [view, setView] = useState<ChapterMindMapView | "unreachable" | null>(null);

  useEffect(() => {
    let current = true;

    void actions
      .read(chapter.chapterId)
      .catch(() => null)
      .then((read) => {
        if (current) {
          setView(read ?? "unreachable");
        }
      });

    return () => {
      current = false;
    };
  }, [actions, chapter.chapterId]);

  if (view !== null && view !== "unreachable" && view.status === "unavailable") {
    return null;
  }

  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-2" data-slot="finished-chapter">
      <PageSectionLabel id={labelId}>{t("Chapter finished")}</PageSectionLabel>
      {view === null && <RowSkeleton title={chapter.title} />}
      {view === "unreachable" && <Unreachable onRetry={onRetry} title={chapter.title} />}
      {view !== null && view !== "unreachable" && (
        <MindMapRow
          actions={actions}
          onViewChange={setView}
          place="finish"
          plus={plus}
          view={view}
        />
      )}
    </section>
  );
}

/** Reads the map once it's shown: the completion only says which chapter it finished. */
export function FinishedChapterMap(props: FinishedChapterMapInput) {
  const [attempt, setAttempt] = useState(0);

  return (
    <ReadChapterMap {...props} key={attempt} onRetry={() => setAttempt((count) => count + 1)} />
  );
}
