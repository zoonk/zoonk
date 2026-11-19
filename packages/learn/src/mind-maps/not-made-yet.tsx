"use client";

import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { type MindMapAllowanceStop } from "@zoonk/core/mind-maps/contract";
import { Button } from "@zoonk/ui/components/button";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { PlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Disclosure } from "../_components/disclosure";
import { MindMapLimitNotice, useLiveLimit } from "../_components/help-limit-notice";
import { LIST_GROUP_CLASS, ListGroup } from "../_components/list-group";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { StatusRegion } from "../_components/status-region";
import { useHeldSlot } from "../_utils/use-held-slot";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { FoldRow, focusRevealedRow } from "../today/today-fold-row";
import {
  type MindMapsPageChapter,
  countChapterMaps,
  groupBySubject,
  needsAttention,
  orderNotMade,
  startsNoMap,
  toMindMapLimit,
} from "./_utils/mind-maps-page";
import { MindMapRowView } from "./mind-map-row";
import { type MindMapsLibrary } from "./use-mind-maps-library";

const LINE_CLASS = "text-muted-foreground max-w-prose text-sm text-pretty";

/** What stops a new map on this page: a refusal while the list is read again, then the list's offer. */
export function useShownStop({ page, refusal }: MindMapsLibrary) {
  return refusal ?? (startsNoMap(page.createOffer) ? page.createOffer.stop : null);
}

/** The gate holds until a read lifts it; the clock only decides whether its day still prints. */
function useNoticeStop(stop: MindMapAllowanceStop): MindMapAllowanceStop {
  const comingDay = useLiveLimit(stop);
  return comingDay ?? { ...stop, availableAt: null };
}

function PageStopNotice({ stop, tier }: { stop: MindMapAllowanceStop; tier: EntitlementTier }) {
  const routes = useLearnRoutes();
  const mountedAt = useMountTime();
  const shown = useNoticeStop(stop);

  return (
    <MindMapLimitNotice
      limit={toMindMapLimit({ now: mountedAt.getTime(), stop: shown, tier })}
      linkComponent={LearnLink}
      routes={routes}
    />
  );
}

/**
 * Only the first line that applies shows, so the block never stacks paragraphs. A stop on new maps
 * outranks maps on their way. Each of those rows, and each map that didn't finish with its Try
 * again, says so itself, and the group they sit in opens on arrival.
 */
function NotMadeLine({
  chapters,
  library,
  tier,
}: {
  chapters: readonly MindMapsPageChapter[];
  library: MindMapsLibrary;
  tier: EntitlementTier;
}) {
  const t = useExtracted();
  const { bulk, follower, page } = library;
  const { eligible, startable } = page.createOffer;
  const shownStop = useShownStop(library);
  const { onTheWay } = countChapterMaps(chapters);

  if (follower.isStuck) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className={LINE_CLASS}>{t("We couldn't reach the server. Check your connection.")}</p>
        <Button onClick={follower.retry} size="sm" variant="outline">
          {t("Try again")}
        </Button>
      </div>
    );
  }

  if (bulk.status === "unreachable") {
    return (
      <p className={LINE_CLASS}>{t("We couldn't reach the server. Check your connection.")}</p>
    );
  }

  if (shownStop && bulk.status !== "sending") {
    return <PageStopNotice stop={shownStop} tier={tier} />;
  }

  if (onTheWay > 0) {
    return (
      <p className={LINE_CLASS}>
        {t(
          "{count, plural, one {# on the way. You can leave while it's made.} other {# on the way. You can leave while they're made.}}",
          { count: onTheWay },
        )}
      </p>
    );
  }

  if (startable > 0 && startable < eligible) {
    return (
      <p className={LINE_CLASS}>
        {t(
          "{count, plural, one {You can create # more map right now.} other {You can create # more maps right now.}}",
          { count: startable },
        )}
      </p>
    );
  }

  return null;
}

type RowsProps = {
  library: MindMapsLibrary;
  /** The line saying what writing lessons costs, which each Create that writes some points to. */
  lessonsWarningId?: string;
  plus: boolean;
};

function NotMadeRows({
  chapters,
  label,
  lessonsWarningId,
  library,
  plus,
}: RowsProps & { chapters: readonly MindMapsPageChapter[]; label?: string }) {
  return (
    <ul aria-label={label} className={LIST_GROUP_CLASS}>
      {chapters.map((chapter) => (
        <li key={chapter.chapterId}>
          <MindMapRowView
            createDescribedBy={chapter.lessonsToWrite > 0 ? lessonsWarningId : undefined}
            place="library"
            plus={plus}
            request={library.row(chapter)}
            view={{ ...chapter, image: null, outline: null }}
          />
        </li>
      ))}
    </ul>
  );
}

function RestBySubject({
  chapters,
  ...rows
}: RowsProps & { chapters: readonly MindMapsPageChapter[] }) {
  const t = useExtracted();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const revealed = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef(false);
  const groups = groupBySubject(chapters);

  useEffect(() => {
    if (open && focusOnOpen.current) {
      focusRevealedRow(revealed.current?.querySelector("li"));
    }

    focusOnOpen.current = false;
  }, [open]);

  if (groups.every((group) => group.name !== null)) {
    return (
      <ListGroup data-slot="maps-not-made-subjects">
        {groups.map((group) => (
          <Disclosure
            aside={group.rows.length}
            defaultOpen={group.rows.some((chapter) => needsAttention(chapter))}
            icon={null}
            key={group.key}
            title={group.name ?? ""}
          >
            <NotMadeRows chapters={group.rows} {...rows} />
          </Disclosure>
        ))}
      </ListGroup>
    );
  }

  return (
    <>
      <div className="contents" id={listId} ref={revealed}>
        {open && <NotMadeRows chapters={chapters} {...rows} />}
      </div>
      <FoldRow
        controls={listId}
        done={false}
        label={
          open
            ? t("Show fewer chapters")
            : t("{count, plural, one {# more chapter} other {# more chapters}}", {
                count: chapters.length,
              })
        }
        onToggle={() => {
          focusOnOpen.current = !open;
          setOpen(!open);
        }}
        open={open}
      />
    </>
  );
}

/**
 * The chapters without a map, beside the learner's maps: the next few, the rest folded by subject,
 * one button that makes every map it can and one line on what's happening.
 */
export function NotMadeYet({
  chapters,
  library,
  tier,
}: {
  chapters: readonly MindMapsPageChapter[];
  library: MindMapsLibrary;
  tier: EntitlementTier;
}) {
  const t = useExtracted();
  const { bulk, page } = library;
  const { needLessons, startable, stop } = page.createOffer;
  const plus = tier === "plus";
  const studied = new Set(page.lessonGroups.map((group) => group.chapterId));
  const { next, rest } = orderNotMade({ chapters, studied });
  const slot = useHeldSlot<HTMLDivElement>(useShownStop(library) !== null);
  const titleId = useId();
  const lessonsWarningId = useId();
  const warnsLessons = !plus && needLessons > 0 && stop === null;
  const rows = { lessonsWarningId: warnsLessons ? lessonsWarningId : undefined, library, plus };

  return (
    <PageSection aria-labelledby={titleId} className="gap-3" data-slot="maps-not-made">
      <PageSectionHeader>
        <PageSectionTitle id={titleId}>
          {t({
            description: "Heading over the chapters whose mind map hasn't been made yet.",
            message: "No map yet",
          })}
        </PageSectionTitle>
        <PageSectionDetail>{chapters.length}</PageSectionDetail>
      </PageSectionHeader>

      {warnsLessons && (
        <p className={LINE_CLASS} id={lessonsWarningId}>
          {t("Creating maps counts toward your free lessons.")}
        </p>
      )}

      <div className="flex flex-col">
        <NotMadeRows chapters={next} {...rows} />
        {rest.length > 0 && <RestBySubject chapters={rest} {...rows} />}
      </div>

      <div
        className="flex flex-col gap-3 [&:not([data-held]):not(:has(>:not(:empty)))]:contents"
        ref={slot}
      >
        {startable > 1 && !library.refusal && (
          <Button
            busy={bulk.status === "sending"}
            className="self-start"
            icon={<PlusIcon aria-hidden="true" />}
            onClick={bulk.createAll}
            size="sm"
            variant="outline"
          >
            {t("Create all")}
          </Button>
        )}

        <StatusRegion>
          <NotMadeLine chapters={chapters} library={library} tier={tier} />
        </StatusRegion>
      </div>
    </PageSection>
  );
}
