"use client";

import { type LanguageUnitView } from "@zoonk/core/view-models/language/contract";
import { MapPinnedIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  DetailActions,
  DetailContinueLink,
  DetailEyebrow,
  DetailFacts,
  DetailHero,
  DetailHeroText,
  DetailTitle,
} from "../../_components/detail-page";
import { KindTile } from "../../_components/kind-tile";
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

/** "4 lessons · About 26 min": how much the unit holds. */
function UnitFacts({ lessons }: { lessons: LanguageUnitView["lessons"] }) {
  const t = useExtracted();
  const minutes = lessons.reduce((sum, lesson) => sum + lesson.minutes, 0);

  if (lessons.length === 0) {
    return null;
  }

  const facts = [
    t("{count, plural, one {# lesson} other {# lessons}}", { count: lessons.length }),
    minutes > 0 && t("About {minutes, number} min", { minutes }),
  ].filter(Boolean);

  return <DetailFacts>{facts.join(" · ")}</DetailFacts>;
}

/**
 * The unit's tile (a place: every unit is a real situation), "Unit 2 · A1–A2", its title, how much
 * it holds, then "Continue" into the next lesson with how far the learner is in the unit and the
 * unit's "…" beside it.
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
  const next = lessons.find((lesson) => !lesson.done);

  return (
    <>
      <DetailHero>
        <KindTile icon={MapPinnedIcon} kind="lesson" size="lg" />
        <DetailHeroText>
          <DetailEyebrow>
            <UnitEyebrow unit={unit} />
          </DetailEyebrow>
          <DetailTitle>{unit.title}</DetailTitle>
          <UnitFacts lessons={lessons} />
        </DetailHeroText>
      </DetailHero>

      <DetailActions className="empty:hidden">
        {next && (
          <DetailContinueLink
            href={lessonHref(next.lessonId)}
            share={done / lessons.length}
            started={done > 0}
          />
        )}
        <ContentVoteMenu
          label={t("Unit options")}
          screen="unit"
          size="detail"
          target={{ contentId: unit.chapterId, contentKind: "chapter" }}
          votes={false}
        />
      </DetailActions>
    </>
  );
}

/** The unit's bar: back to the Journey; the unit's "…" sits beside its main action. */
export function UnitBar({ backHref, view }: { backHref: string; view: LanguageUnitView }) {
  const t = useExtracted();

  return <LearnPageBar back={{ href: backHref, label: t("Journey") }} title={view.unit.title} />;
}
