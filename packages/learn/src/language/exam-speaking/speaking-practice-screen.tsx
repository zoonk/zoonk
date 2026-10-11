"use client";

import { type SpeakingPaperView } from "@zoonk/core/language/exam-speaking/contract";
import { type LanguageTodayView } from "@zoonk/core/view-models/language/contract";
import { useExtracted } from "next-intl";
import {
  DetailAside,
  DetailContent,
  DetailEyebrow,
  DetailFacts,
  DetailHero,
  DetailHeroText,
  DetailLayout,
  DetailTitle,
} from "../../_components/detail-page";
import { KindTile } from "../../_components/kind-tile";
import {
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../../_components/list-group";
import { PlusMark } from "../../_components/plus-lock";
import { LearnPageBar } from "../../shell/learn-bar";
import { type ExamTaskStart, SpeakingPaperSection } from "./speaking-paper-section";
import { useTaskMinutes } from "./speaking-task-row";

/**
 * A language goal's exam-style speaking tasks as a row of "Practice anytime", marked Plus when
 * the learner's plan doesn't include them.
 */
export function SpeakingPracticeRow({
  entry,
  href,
}: {
  entry: NonNullable<LanguageTodayView["speaking"]>;
  href: string;
}) {
  const t = useExtracted();

  return (
    <ListRowLink href={href}>
      <ListRowLeading>
        <KindTile kind="conversation" />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{t("Exam-style speaking")}</ListRowTitle>
        <ListRowDescription>
          {t("{exam} tasks on a call", { exam: entry.title })}
        </ListRowDescription>
      </ListRowContent>
      {entry.access === "plusRequired" && (
        <ListRowTrailing>
          <PlusMark />
        </ListRowTrailing>
      )}
    </ListRowLink>
  );
}

/**
 * A language goal's speaking practice in an exam's format, at the level the learner aims for: the
 * paper named under its tile with how many tasks and how long, and that it's an official exam
 * the learner needn't take (a goal that names none practices its language's), then its tasks to
 * open one at a time. A result's "Next" comes back here with the next task open (`openTask`).
 */
export function SpeakingPracticeScreen({
  backHref,
  onStart,
  openTask,
  paper,
  resultHref,
}: {
  backHref: string;
  onStart: (task: string) => Promise<ExamTaskStart>;
  openTask: string | null;
  paper: SpeakingPaperView;
  resultHref: (conversationId: string) => string;
}) {
  const t = useExtracted();
  const minutes = useTaskMinutes();

  return (
    <div className="flex flex-col gap-8">
      <LearnPageBar back={{ href: backHref, label: t("Today") }} title={t("Speaking practice")} />

      <DetailLayout>
        <DetailAside>
          <DetailHero>
            <KindTile kind="conversation" size="lg" />
            <DetailHeroText>
              <DetailEyebrow>{t("Exam-style speaking")}</DetailEyebrow>
              <DetailTitle>{paper.title}</DetailTitle>
              <DetailFacts>
                {t("{count, plural, one {# task} other {# tasks}} · {minutes} in the exam", {
                  count: paper.tasks.length,
                  minutes: minutes(paper.minutes),
                })}
              </DetailFacts>
            </DetailHeroText>
          </DetailHero>

          <p className="text-muted-foreground text-sm text-pretty">
            {t(
              "{exam} is an official exam. Practice its speaking tasks whether or not you plan to take it.",
              { exam: paper.title },
            )}
          </p>
        </DetailAside>

        <DetailContent>
          <SpeakingPaperSection
            onStart={onStart}
            openTask={openTask}
            paper={paper}
            resultHref={resultHref}
            title={t("Tasks")}
          />
        </DetailContent>
      </DetailLayout>
    </div>
  );
}
