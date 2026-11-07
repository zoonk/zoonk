"use client";

import { type ChapterMindMapView } from "@zoonk/core/mind-maps/contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { LockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { MindMapLimitNotice } from "../_components/help-limit-notice";
import { KindIcon } from "../_components/kind-tile";
import {
  LIST_ROW_CLASS,
  LIST_ROW_INTERACTIVE_CLASS,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";
import { StatusRegion } from "../_components/status-region";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { toMindMapSrc } from "./_utils/mind-map-urls";
import { type MindMapActions } from "./mind-map-actions";
import { MindMapViewer } from "./mind-map-viewer";
import { type MindMapShown, useMindMapRequest } from "./use-mind-map-request";

/**
 * Where the row sits changes only its words: the chapter page names it "Mind map", the moment a
 * chapter ends and the Mind maps page name the chapter.
 */
type MindMapRowPlace = "chapter" | "finish" | "library";

const SLOT_CLASS = "flex size-12 shrink-0 items-center justify-center rounded-lg";

const ACTION_CLASS = buttonVariants({ size: "sm", variant: "outline" });

function SlotMark({ shown }: { shown: MindMapShown }) {
  if (shown === "drawing" || shown === "writingLessons") {
    return <Spinner className="text-muted-foreground size-4" role="presentation" />;
  }

  if (shown === "plusRequired") {
    return <LockIcon className="text-muted-foreground size-4" />;
  }

  return <KindIcon kind="mindMap" />;
}

function MapSlot({ shown, view }: { shown: MindMapShown; view: ChapterMindMapView }) {
  if (shown === "ready" && view.image) {
    return (
      // oxlint-disable-next-line next/no-img-element -- @zoonk/learn doesn't depend on next/image; thumbnails are stored, optimized webp files.
      <img
        alt=""
        className={cn(SLOT_CLASS, "ring-border bg-card object-cover ring-1")}
        decoding="async"
        height={48}
        src={toMindMapSrc(view.image.thumbnailUrl)}
        width={48}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(SLOT_CLASS, "border-input border border-dashed")}
      data-slot="mind-map-slot"
    >
      <SlotMark shown={shown} />
    </span>
  );
}

/** A list says once, above its rows, what writing the lessons costs and what Plus opens (`MindMapsScreen`). */
function useAvailableLine({ place, plus, shown, view }: RowCopyInput): string | null {
  const t = useExtracted();

  if (shown === "plusRequired" && place === "library") {
    return t("Plus");
  }

  const writesLessons = view.lessonsToWrite > 0 && shown !== "plusRequired";

  if (writesLessons && place === "library") {
    return t("Lessons not written yet");
  }

  if (writesLessons) {
    return plus
      ? t("Its lessons get written first, so it takes a few minutes.")
      : t("Its lessons get written first and count toward your free lessons.");
  }

  return place === "library" ? null : t("Its main ideas in one picture");
}

type RowCopyInput = {
  place: MindMapRowPlace;
  plus: boolean;
  shown: MindMapShown;
  view: ChapterMindMapView;
};

function useReadyLine({ place, view }: RowCopyInput): string | null {
  const t = useExtracted();

  if (!view.image) {
    return place === "library"
      ? t("As text")
      : t("Its picture had mistakes, so here's the mind map as text.");
  }

  if (place === "finish") {
    return t("Mind map ready");
  }

  return place === "chapter" ? t("Its main ideas in one picture") : null;
}

function useStateLines(input: RowCopyInput): { hint: string | null; line: string | null } {
  const t = useExtracted();
  const available = useAvailableLine(input);
  const ready = useReadyLine(input);

  if (input.shown === "writingLessons") {
    return {
      hint: t("This takes a few minutes. You can leave; it'll be here."),
      line: t("Writing the lessons, then the mind map…"),
    };
  }

  if (input.shown === "drawing") {
    return {
      hint: t("About half a minute. You can leave; it'll be here."),
      line: t("Drawing the mind map…"),
    };
  }

  if (input.shown === "failed") {
    return { hint: null, line: t("It couldn't be made this time.") };
  }

  if (input.shown === "unreachable") {
    return { hint: null, line: t("We couldn't reach the server. Check your connection.") };
  }

  return { hint: null, line: input.shown === "ready" ? ready : available };
}

function RowText({ input, titleId }: { input: RowCopyInput; titleId: string }) {
  const t = useExtracted();
  const { hint, line } = useStateLines(input);
  const { place, shown, view } = input;
  const chapter = t("Chapter {number, number}", { number: view.position });

  return (
    <ListRowContent aria-live="polite">
      <ListRowTitle className="wrap-break-word" id={titleId}>
        {place === "chapter" ? t("Mind map") : view.title}
        {shown === "plusRequired" && place !== "library" && (
          <span className="sr-only">{` (${t("Available with Plus")})`}</span>
        )}
      </ListRowTitle>

      {(line || place === "library") && (
        <ListRowDescription className="text-pretty">
          {place === "library" && line ? `${chapter} · ${line}` : (line ?? chapter)}
        </ListRowDescription>
      )}

      {hint && <ListRowDescription className="text-pretty">{hint}</ListRowDescription>}
    </ListRowContent>
  );
}

function RowAction({
  isPending,
  onCreate,
  onRetry,
  shown,
  slowDown,
  titleId,
}: {
  isPending: boolean;
  onCreate: () => void;
  onRetry: () => void;
  shown: MindMapShown;
  slowDown: boolean;
  titleId: string;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();

  if (shown === "plusRequired") {
    return (
      <LearnLink aria-describedby={titleId} className={ACTION_CLASS} href={routes.upgrade}>
        {t("See Plus")}
      </LearnLink>
    );
  }

  if (shown === "failed" || shown === "unreachable") {
    return (
      <Button
        aria-describedby={titleId}
        busy={isPending}
        onClick={onRetry}
        size="sm"
        variant="outline"
      >
        {t("Try again")}
      </Button>
    );
  }

  if (shown === "available" || (shown === "refused" && slowDown)) {
    return (
      <Button
        aria-describedby={titleId}
        busy={isPending}
        onClick={onCreate}
        size="sm"
        variant="outline"
      >
        {t("Create")}
      </Button>
    );
  }

  return null;
}

/** The same row on the chapter page, at a chapter's end and on the Mind maps page. */
export function MindMapRow({
  actions,
  place,
  plus,
  view: served,
}: {
  actions: MindMapActions;
  place: MindMapRowPlace;
  plus: boolean;
  view: ChapterMindMapView;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const request = useMindMapRequest({ actions, view: served });
  const { create, isPending, limit, retry, shown, view } = request;
  const input: RowCopyInput = { place, plus, shown, view };
  const ready = shown === "ready" && view.outline !== null;

  if (shown === "unavailable") {
    return null;
  }

  const lockedInList = place === "library" && shown === "plusRequired";

  const body = (
    <>
      <ListRowLeading className="py-2">
        <MapSlot shown={shown} view={view} />
      </ListRowLeading>
      <RowText input={input} titleId={titleId} />
    </>
  );

  return (
    <div className="flex flex-col gap-1" data-slot="mind-map-row">
      {ready && (
        <button className={LIST_ROW_INTERACTIVE_CLASS} onClick={() => setOpen(true)} type="button">
          {body}
          <span className={cn(ACTION_CLASS, "self-center")}>{t("Open")}</span>
        </button>
      )}

      {lockedInList && <ListRowLink href={routes.upgrade}>{body}</ListRowLink>}

      {!ready && !lockedInList && (
        <div className={LIST_ROW_CLASS}>
          {body}
          <span className="flex shrink-0 items-center empty:hidden">
            <RowAction
              isPending={isPending}
              onCreate={create}
              onRetry={retry}
              shown={shown}
              slowDown={limit?.status === "slowDown"}
              titleId={titleId}
            />
          </span>
        </div>
      )}

      <StatusRegion>
        {limit && !isPending && (
          <MindMapLimitNotice limit={limit} linkComponent={LearnLink} routes={routes} />
        )}
      </StatusRegion>

      {ready && (
        <MindMapViewer
          image={view.image}
          onOpenChange={setOpen}
          open={open}
          outline={view.outline}
          title={view.title}
        />
      )}
    </div>
  );
}
