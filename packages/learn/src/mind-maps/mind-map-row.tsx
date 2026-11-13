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
  LIST_ROW_FIRST_LINE_CLASS,
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
import { type MindMapActions } from "./mind-map-actions";
import { type MindMapCopyInput, type MindMapRowPlace, useStateLines } from "./mind-map-copy";
import { MindMapSlot } from "./mind-map-slot";
import { MindMapViewer } from "./mind-map-viewer";
import { type MindMapRequest, type MindMapShown, useMindMapRequest } from "./use-mind-map-request";

const ACTION_CLASS = buttonVariants({ size: "sm", variant: "outline" });

/**
 * Room for a title and the two lines a map being made shows, so pressing Create, or a row a
 * lesson's end reads in late, moves nothing under it.
 */
export const MIND_MAP_ROW_CLASS = "min-h-20";

function SlotMark({ shown }: { shown: MindMapShown }) {
  if (shown === "drawing" || shown === "writingLessons") {
    return <Spinner className="text-muted-foreground size-4" role="presentation" />;
  }

  if (shown === "plusRequired") {
    return <LockIcon className="text-muted-foreground size-4" />;
  }

  return <KindIcon kind="mindMap" />;
}

function RowText({ input, titleId }: { input: MindMapCopyInput; titleId: string }) {
  const t = useExtracted();
  const { hint, line } = useStateLines(input);
  const { place, view } = input;

  return (
    <ListRowContent aria-live="polite" className={cn(place === "finish" && "justify-start")}>
      <ListRowTitle className="wrap-break-word" id={titleId}>
        {place === "chapter" ? t("Mind map") : view.title}
      </ListRowTitle>

      {line && <ListRowDescription className="text-pretty">{line}</ListRowDescription>}

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
  onCreate?: () => void;
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

  if (onCreate && (shown === "available" || (shown === "refused" && slowDown))) {
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

/**
 * Without `save`, the row never opens its map: the Mind maps page lists the ready ones itself.
 * Without `create`, it offers none, as when no new map can start now.
 */
export type MindMapRowRequest = Pick<MindMapRequest, "isPending" | "limit" | "retry" | "shown"> &
  Partial<Pick<MindMapRequest, "create" | "save">>;

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
  request: MindMapRowRequest;
  view: ChapterMindMapView;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const { create, isPending, limit, retry, save, shown } = request;
  const input: MindMapCopyInput = { place, plus, shown, view };
  const ready = shown === "ready" && view.outline !== null && save !== undefined;

  if (shown === "unavailable") {
    return null;
  }

  const locked = shown === "plusRequired";

  // A lesson's end shows one row over "Up next", so it takes that row's mark and text edge.
  const alone = place === "finish";

  const body = (
    <>
      {alone ? (
        <ListRowLeading className={LIST_ROW_FIRST_LINE_CLASS}>
          <SlotMark shown={shown} />
        </ListRowLeading>
      ) : (
        <ListRowLeading className="py-2">
          <MindMapSlot thumbnailUrl={shown === "ready" ? (view.image?.thumbnailUrl ?? null) : null}>
            <SlotMark shown={shown} />
          </MindMapSlot>
        </ListRowLeading>
      )}
      <RowText input={input} titleId={titleId} />
    </>
  );

  return (
    <div className={cn("flex flex-col gap-1", className)} data-slot="mind-map-row">
      {ready && (
        <button
          className={cn(LIST_ROW_INTERACTIVE_CLASS, MIND_MAP_ROW_CLASS)}
          onClick={() => setOpen(true)}
          type="button"
        >
          {body}
          <span className={cn(ACTION_CLASS, "self-center")}>{t("Open")}</span>
        </button>
      )}

      {locked && (
        <ListRowLink className={MIND_MAP_ROW_CLASS} href={routes.upgrade}>
          {body}
          <ListRowTrailing>
            <PlusMark className="font-sans" />
          </ListRowTrailing>
        </ListRowLink>
      )}

      {!ready && !locked && (
        <div className={cn(LIST_ROW_CLASS, MIND_MAP_ROW_CLASS)}>
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

      {ready && save && (
        <MindMapViewer
          image={view.image}
          onOpenChange={setOpen}
          open={open}
          outline={view.outline}
          save={save}
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
