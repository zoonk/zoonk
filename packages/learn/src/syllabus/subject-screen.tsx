"use client";

import { type SyllabusSubject, type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import {
  DetailActions,
  DetailAside,
  DetailContent,
  DetailContinueLink,
  DetailEyebrow,
  DetailFacts,
  DetailHero,
  DetailHeroText,
  DetailLayout,
  DetailTitle,
} from "../_components/detail-page";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { ReportProblemMenu } from "../feedback/content-vote-menu";
import { MindMapsReference } from "../mind-maps/mind-maps-reference";
import { LearnPageBar } from "../shell/learn-bar";
import { SubjectChapters } from "./subject-chapters";
import { SubjectIcon } from "./subject-icon";
import { SubjectMatrix } from "./subject-matrix";
import { NotPlannedCallout, type SubjectActions } from "./subject-not-planned";
import { SubjectTopics } from "./subject-topics";
import { SubjectWrittenPractice } from "./subject-written-practice";
import { TopicFrequencyNote } from "./syllabus-notes";

const TOPICS_TITLE_ID = "subject-topics-title";

/** Long official names ("Processo Legislativo e Regimento Interno…") take a size that still fits. */
const LONG_NAME = 60;

/** Where a subject's page leads: back, each chapter's page, and the plan's adjustments. */
export type SubjectHrefs = {
  /** The Journey, where the plan is adjusted. */
  adjust: string;
  back: string;
  chapter: (chapterId: string) => string;
  /**
   * The goal's mind maps, opened at this subject's; absent until one of its finished chapters has a
   * map or can get one (its lessons were written), and where chapters get none.
   */
  mindMaps?: (subjectKey: string) => string;
};

/** The small line above the name: the notice's group, or what kind of part of the goal this is. */
function useEyebrow({
  fromMaterial,
  kind,
  subject,
}: {
  fromMaterial: boolean;
  kind: SyllabusView["kind"];
  subject: SyllabusSubject;
}) {
  const t = useExtracted();

  if (subject.group) {
    return subject.group;
  }

  if (subject.source === "notice") {
    return fromMaterial ? t("From your material") : t("Exam subject");
  }

  if (kind !== "notice") {
    return t("Module");
  }

  return fromMaterial ? t("Also in your plan") : t("Beyond the notice");
}

/** What the subject weighs in the exam: its questions, or its share when the notice gives that. */
function useWeightFact(subject: SyllabusSubject): string | null {
  const t = useExtracted();
  const format = useFormatter();

  // A written test (an essay) has no questions to count.
  if (subject.questions) {
    return t("{count, plural, one {# question} other {# questions}}", { count: subject.questions });
  }

  if (subject.share === null) {
    return null;
  }

  return t("{share} of the exam", {
    share: format.number(subject.share, { maximumFractionDigits: 0, style: "percent" }),
  });
}

/** "45 questions · 23 topics · 9 chapters": what the subject weighs and holds, in one line. */
function SubjectFacts({ subject }: { subject: SyllabusSubject }) {
  const t = useExtracted();
  const weight = useWeightFact(subject);

  const facts = [
    weight,
    subject.topics.length > 0 &&
      t("{count, plural, one {# topic} other {# topics}}", { count: subject.topics.length }),
    subject.chapters.length > 0 &&
      t("{count, plural, one {# chapter} other {# chapters}}", { count: subject.chapters.length }),
  ].filter(Boolean);

  if (facts.length === 0) {
    return null;
  }

  return <DetailFacts>{facts.join(" · ")}</DetailFacts>;
}

/**
 * How far the subject is, for its button: its topics studied when the plan says which topics it
 * teaches, otherwise its lessons done.
 */
function getSubjectShare(subject: SyllabusSubject): number {
  if (subject.topicsStudied !== null && subject.topics.length > 0) {
    return subject.topicsStudied / subject.topics.length;
  }

  return subject.lessonsTotal > 0 ? subject.lessonsDone / subject.lessonsTotal : 0;
}

/**
 * "Continue 32%" into the subject's next chapter (none once every chapter is done), and the
 * subject's "…" beside it.
 */
function SubjectActionsRow({
  chapterHref,
  subject,
}: {
  chapterHref: (chapterId: string) => string;
  subject: SyllabusSubject;
}) {
  const t = useExtracted();
  const next = subject.chapters.find((chapter) => chapter.state !== "done" && chapter.chapterId);
  const nextId = subject.notPlannedReason ? null : (next?.chapterId ?? null);

  return (
    <DetailActions className="empty:hidden">
      {nextId && (
        <DetailContinueLink
          href={chapterHref(nextId)}
          share={getSubjectShare(subject)}
          started={subject.lessonsDone > 0}
        />
      )}
      <ReportProblemMenu label={t("Subject options")} screen="subject" />
    </DetailActions>
  );
}

/** The subject's icon and name as the notice writes it, what it weighs and holds, and the way in. */
function SubjectHeader({
  chapterHref,
  fromMaterial,
  kind,
  subject,
}: {
  chapterHref: (chapterId: string) => string;
  fromMaterial: boolean;
  kind: SyllabusView["kind"];
  subject: SyllabusSubject;
}) {
  const eyebrow = useEyebrow({ fromMaterial, kind, subject });

  return (
    <>
      <DetailHero>
        <SubjectIcon imageUrl={subject.imageUrl} size="lg" />
        <DetailHeroText>
          <DetailEyebrow>{eyebrow}</DetailEyebrow>
          <DetailTitle
            className={cn(subject.name.length > LONG_NAME && "text-2xl lg:text-[1.625rem]")}
          >
            {subject.name}
          </DetailTitle>
          <SubjectFacts subject={subject} />
        </DetailHeroText>
      </DetailHero>

      <SubjectActionsRow chapterHref={chapterHref} subject={subject} />
    </>
  );
}

function TopicsSection({
  chapterHref,
  fromMaterial,
  subject,
}: {
  chapterHref: (chapterId: string) => string;
  fromMaterial: boolean;
  subject: SyllabusSubject;
}) {
  const t = useExtracted();
  const studied = subject.topics.filter((topic) => topic.status === "studied").length;

  return (
    <PageSection aria-labelledby={TOPICS_TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={TOPICS_TITLE_ID}>
          {fromMaterial ? t("Topics in your material") : t("Topics in the notice")}
        </PageSectionTitle>
        <PageSectionDetail>
          {subject.topicsStudied === null
            ? t("{count, plural, one {# topic} other {# topics}}", { count: subject.topics.length })
            : t(
                "{total, plural, one {{done, number} of # topic} other {{done, number} of # topics}}",
                { done: studied, total: subject.topics.length },
              )}
        </PageSectionDetail>
      </PageSectionHeader>

      <SubjectTopics
        chapterHref={chapterHref}
        labelledBy={TOPICS_TITLE_ID}
        topics={subject.topics}
      />

      <TopicFrequencyNote fromMaterial={fromMaterial} subject={subject} />
    </PageSection>
  );
}

/**
 * A subject of the goal, to answer "how far am I, what's next, and is all of it covered?": its
 * name as the notice writes it with what it weighs, "Continue" with how far the learner is in it,
 * then its chapters (the next one marked, the way in) and the notice's topics as the notice's own
 * outline, each ticked and opening to the chapters that teach it. From `lg` the name and the button
 * stay on the left while the sections scroll on the right. A subject outside the plan says so, and
 * why.
 */
export function SubjectScreen({
  actions,
  hrefs,
  subject,
  syllabus,
}: {
  actions: SubjectActions;
  hrefs: SubjectHrefs;
  subject: SyllabusSubject;
  syllabus: Pick<SyllabusView, "fromMaterial" | "kind" | "writtenPractice">;
}) {
  const t = useExtracted();

  return (
    <article className="flex flex-col gap-8" data-slot="subject">
      <LearnPageBar back={{ href: hrefs.back, label: t("Journey") }} title={subject.name} />

      <DetailLayout>
        <DetailAside>
          <SubjectHeader
            chapterHref={hrefs.chapter}
            fromMaterial={syllabus.fromMaterial}
            kind={syllabus.kind}
            subject={subject}
          />
          <NotPlannedCallout actions={actions} adjustHref={hrefs.adjust} subject={subject} />
          <SubjectWrittenPractice
            actions={actions}
            practice={syllabus.writtenPractice}
            subject={subject}
          />
        </DetailAside>

        <DetailContent>
          <SubjectChapters chapterHref={hrefs.chapter} chapters={subject.chapters} />

          {subject.topics.length > 0 && (
            <TopicsSection
              chapterHref={hrefs.chapter}
              fromMaterial={syllabus.fromMaterial}
              subject={subject}
            />
          )}

          <SubjectMatrix matrix={subject.matrix} />

          {hrefs.mindMaps && (
            <MindMapsReference
              description={t("This subject's chapters you finished, each in one picture")}
              href={hrefs.mindMaps(subject.key)}
            />
          )}
        </DetailContent>
      </DetailLayout>
    </article>
  );
}
