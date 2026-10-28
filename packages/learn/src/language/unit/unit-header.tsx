"use client";

import { type LanguageUnitView } from "@zoonk/core/view-models/language/contract";
import { useExtracted } from "next-intl";
import {
  DetailActions,
  DetailContinueLink,
  DetailFacts,
  DetailHero,
  DetailHeroText,
  DetailTitle,
  useDoneShare,
} from "../../_components/detail-page";
import { PageEyebrow } from "../../_components/page";
import { useFormatDuration } from "../../_utils/time-format";
import { ContentFeedbackMenu } from "../../feedback/content-feedback-menu";
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
        <PageEyebrow>
          <UnitEyebrow unit={unit} />
        </PageEyebrow>
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
        <ContentFeedbackMenu
          label={t("Unit options")}
          screen="unit"
          size="detail"
          target={{ contentId: unit.chapterId, contentKind: "chapter" }}
        />
      </DetailActions>
    </DetailHero>
  );
}

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
