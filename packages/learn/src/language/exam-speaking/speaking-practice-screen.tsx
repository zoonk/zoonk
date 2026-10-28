"use client";

import { type SpeakingPaperView } from "@zoonk/core/language/exam-speaking/contract";
import { type LanguageTodayView } from "@zoonk/core/view-models/language/contract";
import { useExtracted } from "next-intl";
import {
  DetailAside,
  DetailContent,
  DetailFacts,
  DetailHero,
  DetailHeroText,
  DetailLayout,
  DetailTitle,
} from "../../_components/detail-page";
import { KindDot } from "../../_components/kind-tile";
import {
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../../_components/list-group";
import { PageEyebrow } from "../../_components/page";
import { PlusMark } from "../../_components/plus-lock";
import { LearnPageBar } from "../../shell/learn-bar";
import { type ExamTaskStart, SpeakingPaperSection } from "./speaking-paper-section";
import { useTaskMinutes } from "./speaking-task-row";

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
        <KindDot kind="conversation" />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{t("Exam-style speaking")}</ListRowTitle>
        <ListRowDescription>
          {t("{exam} tasks on a call", { exam: entry.title })}
        </ListRowDescription>
      </ListRowContent>
      {entry.access === "plusRequired" && (
        <ListRowTrailing className="font-sans">
          <PlusMark />
        </ListRowTrailing>
      )}
    </ListRowLink>
  );
}

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
      <LearnPageBar back={{ href: backHref }} root title={t("Speaking practice")} />

      <DetailLayout>
        <DetailAside>
          <DetailHero>
            <DetailHeroText>
              <PageEyebrow>{t("Exam-style speaking")}</PageEyebrow>
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
