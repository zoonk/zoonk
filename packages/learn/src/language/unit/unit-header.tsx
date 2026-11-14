"use client";

import { type LanguageUnitView } from "@zoonk/core/view-models/language/contract";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { DetailFacts, DetailHero, DetailHeroText, DetailTitle } from "@zoonk/ui/components/detail";
import { useExtracted } from "next-intl";
import { DetailContinueLink, useDoneShare } from "../../_components/detail-page";
import { useFormatDuration } from "../../_utils/time-format";
import { ContentFeedbackMenu } from "../../feedback/content-feedback-menu";
import { LearnPageBar } from "../../shell/learn-bar";

function useUnitPlace(unit: LanguageUnitView["unit"]): string {
  const t = useExtracted();

  if (unit.position === null) {
    return unit.levelRange;
  }

  return t("Unit {position, number} · {levels}", {
    levels: unit.levelRange,
    position: unit.position,
  });
}

function UnitFacts({ view }: { view: LanguageUnitView }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const doneShare = useDoneShare();
  const place = useUnitPlace(view.unit);
  const { lessons } = view;
  const minutes = lessons.reduce((sum, lesson) => sum + lesson.minutes, 0);
  const done = lessons.filter((lesson) => lesson.done).length;

  const facts = [
    place,
    lessons.length > 0 &&
      t("{count, plural, one {# lesson} other {# lessons}}", { count: lessons.length }),
    minutes > 0 && formatDuration(minutes),
    lessons.length > 0 && doneShare(done / lessons.length),
  ].filter(Boolean);

  return <DetailFacts>{facts.join(" · ")}</DetailFacts>;
}

export function UnitHeader({ view }: { view: LanguageUnitView }) {
  return (
    <DetailHero>
      <DetailHeroText>
        <DetailTitle>{view.unit.title}</DetailTitle>
        <UnitFacts view={view} />
      </DetailHeroText>
    </DetailHero>
  );
}

export function UnitBottomBar({
  lessonHref,
  view,
}: {
  lessonHref: (lessonId: string) => string;
  view: LanguageUnitView;
}) {
  const { lessons } = view;
  const next = lessons.find((lesson) => lesson.state === "next");

  if (!next) {
    return null;
  }

  return (
    <BottomBar>
      <BottomBarActions>
        <DetailContinueLink
          href={lessonHref(next.lessonId)}
          lessonWritten={next.written}
          started={lessons.some((lesson) => lesson.done)}
        />
      </BottomBarActions>
    </BottomBar>
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
      <ContentFeedbackMenu
        label={t("Unit options")}
        screen="unit"
        target={{ contentId: view.unit.chapterId, contentKind: "chapter" }}
      />
    </LearnPageBar>
  );
}
