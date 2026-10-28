"use client";

import { type SyllabusSubject, type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { useExtracted, useFormatter } from "next-intl";
import {
  DetailActions,
  DetailAside,
  DetailContent,
  DetailContinueLink,
  DetailFacts,
  DetailHero,
  DetailHeroText,
  DetailLayout,
  DetailTitle,
  useDoneShare,
} from "../_components/detail-page";
import {
  PageEyebrow,
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { ReportProblemMenu } from "../feedback/content-feedback-menu";
import { LearnPageBar } from "../shell/learn-bar";
import { SubjectAside, SubjectCoverage } from "./subject-aside";
import { SubjectChapters } from "./subject-chapters";
import { SubjectMatrix } from "./subject-matrix";
import { NotPlannedCallout, type SubjectActions } from "./subject-not-planned";
import { SubjectTopics } from "./subject-topics";
import { SubjectWrittenPractice } from "./subject-written-practice";
import { TopicFrequencyNote } from "./syllabus-notes";
import { KnownTopicsReturnContext } from "./topic-note";
import { getSubjectBar, getSubjectShare, useKnownLine } from "./use-subject-progress";

const TOPICS_TITLE_ID = "subject-topics-title";

type SubjectHrefs = {
  adjust: string;
  back: string;
  chapter: (chapterId: string) => string;
  mindMaps?: (subjectKey: string) => string;
};

function useKindWord({
  document,
  fromMaterial,
  kind,
  subject,
}: {
  document: SyllabusView["examDocument"];
  fromMaterial: boolean;
  kind: SyllabusView["kind"];
  subject: SyllabusSubject;
}) {
  const t = useExtracted();

  if (subject.group) {
    return subject.group;
  }

  if (subject.source === "notice") {
    return fromMaterial ? t("From your material") : t("Subject");
  }

  if (kind !== "notice") {
    return t("Module");
  }

  return fromMaterial
    ? t("Also in your plan")
    : t("{document, select, notice {Beyond the notice} other {Beyond the official guide}}", {
        document,
      });
}

function useWeightFact(subject: SyllabusSubject): string | null {
  const t = useExtracted();
  const format = useFormatter();

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

function useEyebrow(props: Parameters<typeof useKindWord>[0]): string {
  const kindWord = useKindWord(props);
  const weight = useWeightFact(props.subject);
  return [kindWord, weight].filter(Boolean).join(" · ");
}

function SubjectFacts({ subject }: { subject: SyllabusSubject }) {
  const t = useExtracted();
  const doneShare = useDoneShare();
  const known = useKnownLine()(subject);
  const inLessons = !subject.notPlannedReason && subject.preparation === null;

  const facts = [
    subject.topics.length > 0 &&
      t("{count, plural, one {# topic} other {# topics}}", { count: subject.topics.length }),
    subject.chapters.length > 0 &&
      t("{count, plural, one {# chapter} other {# chapters}}", { count: subject.chapters.length }),
    inLessons && doneShare(getSubjectShare(getSubjectBar(subject))),
  ].filter(Boolean);

  return (
    <>
      {facts.length > 0 && <DetailFacts>{facts.join(" · ")}</DetailFacts>}
      {known && <DetailFacts className="pt-0 font-sans">{known}</DetailFacts>}
    </>
  );
}

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
        <DetailContinueLink href={chapterHref(nextId)} started={subject.lessonsDone > 0} />
      )}
      <ReportProblemMenu label={t("Subject options")} screen="subject" />
    </DetailActions>
  );
}

function SubjectHeader({
  chapterHref,
  document,
  fromMaterial,
  kind,
  subject,
}: {
  chapterHref: (chapterId: string) => string;
  document: SyllabusView["examDocument"];
  fromMaterial: boolean;
  kind: SyllabusView["kind"];
  subject: SyllabusSubject;
}) {
  const eyebrow = useEyebrow({ document, fromMaterial, kind, subject });

  return (
    <DetailHero>
      <DetailHeroText>
        <PageEyebrow>{eyebrow}</PageEyebrow>
        <DetailTitle>{subject.name}</DetailTitle>
        <SubjectFacts subject={subject} />
      </DetailHeroText>

      <SubjectActionsRow chapterHref={chapterHref} subject={subject} />
    </DetailHero>
  );
}

function TopicsSection({
  chapterHref,
  document,
  fromMaterial,
  subject,
}: {
  chapterHref: (chapterId: string) => string;
  document: SyllabusView["examDocument"];
  fromMaterial: boolean;
  subject: SyllabusSubject;
}) {
  const t = useExtracted();

  return (
    <PageSection aria-labelledby={TOPICS_TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={TOPICS_TITLE_ID}>
          {fromMaterial
            ? t("Topics in your material")
            : t(
                "{document, select, notice {Topics in the notice} other {Topics in the official guide}}",
                { document },
              )}
        </PageSectionTitle>
        <PageSectionDetail>
          {subject.topicsStudied === null
            ? t("{count, plural, one {# topic} other {# topics}}", { count: subject.topics.length })
            : t(
                "{total, plural, one {{done, number} of # topic} other {{done, number} of # topics}}",
                { done: subject.topicsStudied, total: subject.topics.length },
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

export function SubjectScreen({
  actions,
  ask,
  hrefs,
  subject,
  syllabus,
}: {
  actions: SubjectActions;
  ask?: { bar: React.ReactNode; row: React.ReactNode };
  hrefs: SubjectHrefs;
  subject: SyllabusSubject;
  syllabus: Pick<
    SyllabusView,
    | "examDocument"
    | "fromMaterial"
    | "kind"
    | "knownTopicsReturn"
    | "questionsSource"
    | "writtenPractice"
  >;
}) {
  const t = useExtracted();

  return (
    <DetailLayout
      aside={
        <SubjectAside
          ask={ask?.row}
          mindMapsHref={hrefs.mindMaps?.(subject.key) ?? null}
          questionsSource={syllabus.questionsSource}
          subject={subject}
        />
      }
      asideLabel={t("About this subject")}
      bar={
        <LearnPageBar back={{ href: hrefs.back, label: t("Plan") }} title={subject.name}>
          {ask && <div className="contents min-[72rem]:hidden">{ask.bar}</div>}
        </LearnPageBar>
      }
      data-slot="subject"
    >
      <DetailAside>
        <SubjectHeader
          chapterHref={hrefs.chapter}
          document={syllabus.examDocument}
          fromMaterial={syllabus.fromMaterial}
          kind={syllabus.kind}
          subject={subject}
        />
        <SubjectCoverage className="min-[72rem]:hidden" labelled subject={subject} />
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
          <KnownTopicsReturnContext value={syllabus.knownTopicsReturn}>
            <TopicsSection
              chapterHref={hrefs.chapter}
              document={syllabus.examDocument}
              fromMaterial={syllabus.fromMaterial}
              subject={subject}
            />
          </KnownTopicsReturnContext>
        )}

        <SubjectMatrix matrix={subject.matrix} />
      </DetailContent>
    </DetailLayout>
  );
}
