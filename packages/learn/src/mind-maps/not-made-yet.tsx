"use client";

import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { Button } from "@zoonk/ui/components/button";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { PlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { Disclosure } from "../_components/disclosure";
import { MindMapLimitNotice } from "../_components/help-limit-notice";
import { LIST_GROUP_CLASS, ListGroup } from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
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
 * Only the first line that applies shows, so the block never stacks paragraphs. With no chapter
 * ready to make, the maps on their way come before the limit: the learner just started them.
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
  const { eligible, needLessons, startable, stop } = page.createOffer;
  const shownStop = bulk.stop ?? (startsNoMap(page.createOffer) ? stop : null);
  const { onTheWay } = countChapterMaps(chapters);
  const stopFirst = eligible > 0 || onTheWay === 0;

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

  if (shownStop && stopFirst && bulk.status !== "sending") {
    return (
      <MindMapLimitNotice
        limit={toMindMapLimit({ now: mountedAt.getTime(), stop: shownStop, tier })}
        linkComponent={LearnLink}
        routes={routes}
      />
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

  if (needLessons > 0) {
    return (
      <p className={LINE_CLASS}>
        {t(
          "{count, plural, one {# chapter needs its lessons written first.} other {# chapters need their lessons written first.}}",
          { count: needLessons },
        )}
      </p>
    );
  }

  return null;
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
  const titleId = useId();
  const { bulk, page } = library;
  const { needLessons, startable } = page.createOffer;
  const plus = tier === "plus";

  return (
    <PageSection aria-labelledby={titleId} data-slot="maps-not-made">
      <PageSectionHeader>
        <PageSectionTitle id={titleId}>{t("Not made yet")}</PageSectionTitle>
      </PageSectionHeader>

      {startable > 0 && (
        <Button
          busy={bulk.status === "sending"}
          className="self-start"
          icon={<PlusIcon aria-hidden="true" />}
          onClick={bulk.createAll}
          size="lg"
          variant="outline"
        >
          {t("{count, plural, one {Create # chapter map} other {Create # chapter maps}}", {
            count: startable,
          })}
        </Button>
      )}

      <StatusRegion>
        <NotMadeLine chapters={chapters} library={library} tier={tier} />
      </StatusRegion>

      <ListGroup>
        <Disclosure aside={chapters.length} icon={null} title={t("Show chapters")}>
          {!plus && needLessons > 0 && !startsNoMap(page.createOffer) && (
            <p className={LINE_CLASS}>{t("Writing lessons counts toward your free lessons.")}</p>
          )}

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
        </Disclosure>
      </ListGroup>
    </PageSection>
  );
}
