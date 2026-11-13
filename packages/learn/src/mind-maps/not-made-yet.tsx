"use client";

import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { Button } from "@zoonk/ui/components/button";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { PlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Disclosure } from "../_components/disclosure";
import { MindMapLimitNotice } from "../_components/help-limit-notice";
import { LIST_GROUP_CLASS, ListGroup } from "../_components/list-group";
import { PageSection } from "../_components/page";
import { StatusRegion } from "../_components/status-region";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import {
  type MindMapsPageChapter,
  countChapterMaps,
  startsNoMap,
  toMindMapLimit,
} from "./_utils/mind-maps-page";
import { MindMapRowView } from "./mind-map-row";
import { type MindMapsLibrary } from "./use-mind-maps-library";

const LINE_CLASS = "text-muted-foreground max-w-prose text-sm text-pretty";

/**
 * Only the first line that applies shows, so the block never stacks paragraphs. Maps on their way
 * and maps that didn't finish come before the limit: the learner just started them, and the limit
 * read first looks like a refusal.
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
  const routes = useLearnRoutes();
  const mountedAt = useMountTime();
  const { bulk, follower, page } = library;
  const { eligible, startable, stop } = page.createOffer;
  const shownStop = bulk.stop ?? (startsNoMap(page.createOffer) ? stop : null);
  const { failed, onTheWay } = countChapterMaps(chapters);

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

  if (failed > 0) {
    return (
      <p className={LINE_CLASS}>
        {t(
          "{count, plural, one {# map didn't finish. Try again.} other {# maps didn't finish. Try again.}}",
          { count: failed },
        )}
      </p>
    );
  }

  if (shownStop && bulk.status !== "sending") {
    return (
      <MindMapLimitNotice
        limit={toMindMapLimit({ now: mountedAt.getTime(), stop: shownStop, tier })}
        linkComponent={LearnLink}
        routes={routes}
      />
    );
  }

  if (startable > 0 && startable < eligible) {
    return (
      <p className={LINE_CLASS}>
        {t(
          "{count, plural, one {You can make # more right now.} other {You can make # more right now.}}",
          { count: startable },
        )}
      </p>
    );
  }

  return null;
}

/** A chapter whose lessons are all written: its map is made, or being made, without writing any. */
export function canMakeNow(chapter: MindMapsPageChapter): boolean {
  return (
    chapter.lessonsToWrite === 0 &&
    (chapter.status === "available" || chapter.status === "drawing" || chapter.status === "failed")
  );
}

function NotMadeRows({
  chapters,
  library,
  plus,
}: {
  chapters: readonly MindMapsPageChapter[];
  library: MindMapsLibrary;
  plus: boolean;
}) {
  return (
    <ul className={LIST_GROUP_CLASS}>
      {chapters.map((chapter) => (
        <li key={chapter.chapterId}>
          <MindMapRowView
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

/**
 * The chapters without a map, after the ones that have one: one button that makes every map it
 * can, one line on what's happening, and each chapter's own row on demand.
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
  const { startable } = page.createOffer;
  const plus = tier === "plus";
  const now = chapters.filter((chapter) => canMakeNow(chapter));
  const later = chapters.filter((chapter) => !canMakeNow(chapter));

  return (
    <PageSection aria-label={t("Other chapters")} data-slot="maps-not-made">
      {now.length > 0 && <NotMadeRows chapters={now} library={library} plus={plus} />}

      {startable > 1 && (
        <Button
          busy={bulk.status === "sending"}
          className="self-start"
          icon={<PlusIcon aria-hidden="true" />}
          onClick={bulk.createAll}
          size="lg"
          variant="outline"
        >
          {t("Create all")}
        </Button>
      )}

      <StatusRegion>
        <NotMadeLine chapters={later} library={library} tier={tier} />
      </StatusRegion>

      <ListGroup>
        <Disclosure
          aside={<span className="font-mono text-xs tabular-nums">{later.length}</span>}
          icon={null}
          title={t("Other chapters")}
        >
          <NotMadeRows chapters={later} library={library} plus={plus} />
        </Disclosure>
      </ListGroup>
    </PageSection>
  );
}
