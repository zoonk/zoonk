"use client";

import { type LanguageUnitView } from "@zoonk/core/view-models/language/contract";
import { useExtracted } from "next-intl";
import {
  DetailActions,
  DetailContinueLink,
  DetailEyebrow,
  DetailFacts,
  DetailHero,
  DetailHeroText,
  DetailTitle,
  useDoneShare,
} from "../../_components/detail-page";
import { useFormatDuration } from "../../_utils/time-format";
import { ContentVoteMenu } from "../../feedback/content-vote-menu";
import { LearnPageBar } from "../../shell/learn-bar";

function UnitEyebrow({ unit }: { unit: LanguageUnitView["unit"] }) {
  const t = useExtracted();

  if (unit.position === null) {
    return unit.levelRange;
  }

  return t("Unit {position, number} · {levels}", {
    levels: unit.levelRange,
    position: unit.position,
  });
}

/**
 * "4 lessons · 26 min · 25% done": how much the unit holds and how far the learner is. The time is
 * its lessons' minutes added up, so it reads like the rows under it.
 */
function UnitFacts({ lessons }: { lessons: LanguageUnitView["lessons"] }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const doneShare = useDoneShare();
  const minutes = lessons.reduce((sum, lesson) => sum + lesson.minutes, 0);
  const done = lessons.filter((lesson) => lesson.done).length;

  if (lessons.length === 0) {
    return null;
  }

  const facts = [
    t("{count, plural, one {# lesson} other {# lessons}}", { count: lessons.length }),
    minutes > 0 && formatDuration(minutes),
    doneShare(done / lessons.length),
  ].filter(Boolean);

  return <DetailFacts>{facts.join(" · ")}</DetailFacts>;
}

/**
 * "Unit 2 · A1–A2", the unit's title, how much it holds and how far the learner is, and "Continue"
 * into the next lesson with the unit's "…" beside it (beside the title from `md`).
 */
export function UnitHeader({
  lessonHref,
  view,
}: {
  lessonHref: (lessonId: string) => string;
  view: LanguageUnitView;
}) {
  const t = useExtracted();
  const { lessons, unit } = view;
  const done = lessons.filter((lesson) => lesson.done).length;
  const next = lessons.find((lesson) => lesson.state === "next");

  return (
    <DetailHero>
      <DetailHeroText>
        <DetailEyebrow>
          <UnitEyebrow unit={unit} />
        </DetailEyebrow>
        <DetailTitle>{unit.title}</DetailTitle>
        <UnitFacts lessons={lessons} />
      </DetailHeroText>

      <DetailActions className="empty:hidden">
        {next && (
          <DetailContinueLink
            href={lessonHref(next.lessonId)}
            lessonWritten={next.written}
            started={done > 0}
          />
        )}
        <ContentVoteMenu
          label={t("Unit options")}
          screen="unit"
          size="detail"
          target={{ contentId: unit.chapterId, contentKind: "chapter" }}
        />
      </DetailActions>
    </DetailHero>
  );
}

/**
 * The unit's bar, as a chapter's: back to the Plan, and "Ask" on the right (`children`); the
 * unit's "…" sits beside its main action.
 */
export function UnitBar({
  backHref,
  children,
  view,
}: {
  backHref: string;
  children?: React.ReactNode;
  view: LanguageUnitView;
}) {
  const t = useExtracted();

  return (
    <LearnPageBar back={{ href: backHref, label: t("Plan") }} title={view.unit.title}>
      {children}
    </LearnPageBar>
  );
}
