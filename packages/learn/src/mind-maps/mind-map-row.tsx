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
  ListRowTrailing,
} from "../_components/list-group";
import { PlusMark } from "../_components/plus-lock";
import { StatusRegion } from "../_components/status-region";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { toMindMapSrc } from "./_utils/mind-map-urls";
import { type MindMapActions } from "./mind-map-actions";
import { type MindMapCopyInput, type MindMapRowPlace, useStateLines } from "./mind-map-copy";
import { MindMapViewer } from "./mind-map-viewer";
import { type MindMapRequest, type MindMapShown, useMindMapRequest } from "./use-mind-map-request";

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

function RowText({ input, titleId }: { input: MindMapCopyInput; titleId: string }) {
  const t = useExtracted();
  const { hint, line } = useStateLines(input);
  const { place, view } = input;
  const chapter = t("Chapter {number, number}", { number: view.position });

  return (
    <ListRowContent aria-live="polite">
      <ListRowTitle className="wrap-break-word" id={titleId}>
        {place === "chapter" ? t("Mind map") : view.title}
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

/** The row for a map whose request someone else follows, like a page that shows it twice. */
export function MindMapRowView({
  className,
  place,
  plus,
  request,
  view,
}: {
  className?: string;
  place: MindMapRowPlace;
  plus: boolean;
  request: MindMapRequest;
  view: ChapterMindMapView;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const { create, isPending, limit, retry, shown } = request;
  const input: MindMapCopyInput = { place, plus, shown, view };
  const ready = shown === "ready" && view.outline !== null;

  if (shown === "unavailable") {
    return null;
  }

  const locked = shown === "plusRequired";

  const body = (
    <>
      <ListRowLeading className="py-2">
        <MapSlot shown={shown} view={view} />
      </ListRowLeading>
      <RowText input={input} titleId={titleId} />
    </>
  );

  return (
    <div className={cn("flex flex-col gap-1", className)} data-slot="mind-map-row">
      {ready && (
        <button className={LIST_ROW_INTERACTIVE_CLASS} onClick={() => setOpen(true)} type="button">
          {body}
          <span className={cn(ACTION_CLASS, "self-center")}>{t("Open")}</span>
        </button>
      )}

      {locked && (
        <ListRowLink href={routes.upgrade}>
          {body}
          {place !== "library" && (
            <ListRowTrailing>
              <PlusMark className="font-sans" />
            </ListRowTrailing>
          )}
        </ListRowLink>
      )}

      {!ready && !locked && (
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

/** The same row on the chapter page, at a chapter's end and on the Mind maps page. */
export function MindMapRow({
  actions,
  onViewChange,
  place,
  plus,
  view,
}: {
  actions: MindMapActions;
  onViewChange: (view: ChapterMindMapView) => void;
  place: MindMapRowPlace;
  plus: boolean;
  view: ChapterMindMapView;
}) {
  const request = useMindMapRequest({ actions, onViewChange, view });

  return <MindMapRowView place={place} plus={plus} request={request} view={view} />;
}
