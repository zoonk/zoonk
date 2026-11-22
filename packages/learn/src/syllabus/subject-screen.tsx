"use client";

import { type SyllabusSubject, type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { DetailFacts, DetailHero, DetailHeroText, DetailTitle } from "@zoonk/ui/components/detail";
import { useExtracted, useFormatter } from "next-intl";
import {
  DetailAside,
  DetailContent,
  DetailContinueLink,
  DetailLayout,
  useDoneShare,
} from "../_components/detail-page";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { FactSegments } from "../_components/task-meta";
import { ReportProblemMenu } from "../feedback/content-feedback-menu";
import { LearnPageBar } from "../shell/learn-bar";
import { useAlsoIn } from "./shared-exams";
import { SubjectAside, SubjectCoverage } from "./subject-aside";
import { SubjectChapters } from "./subject-chapters";
import { SubjectMatrix } from "./subject-matrix";
import { NotPlannedCallout, type SubjectActions } from "./subject-not-planned";
import { SubjectTopics } from "./subject-topics";
import { SubjectWrittenPractice } from "./subject-written-practice";
import { TopicFrequencySource } from "./syllabus-notes";
import { useExtraLabel } from "./use-extra-label";
import { getSubjectBar, getSubjectShare, useKnownLine } from "./use-subject-progress";

const TOPICS_TITLE_ID = "subject-topics-title";

export type SubjectSyllabus = Pick<
  SyllabusView,
  | "examDocument"
  | "fromMaterial"
  | "hasNotice"
  | "questionsSource"
  | "sharedExams"
  | "writtenPractice"
>;

type OriginSyllabus = Pick<
  SubjectSyllabus,
  "examDocument" | "fromMaterial" | "hasNotice" | "sharedExams"
>;

type SubjectHrefs = {
  adjust: string;
  back: string;
  chapter: (chapterId: string) => string;
  mindMaps?: (subjectKey: string) => string;
};

/**
 * Where a subject comes from, when its name doesn't say: study the exam doesn't test, the exam
 * area it belongs to, or the learner's own material.
 */
function useOriginFact({
  subject,
  syllabus,
}: {
  subject: SyllabusSubject;
  syllabus: OriginSyllabus;
}): string | null {
  const t = useExtracted();
  const extraLabel = useExtraLabel();

  if (subject.extra) {
    return extraLabel({ document: syllabus.examDocument, hasNotice: Boolean(syllabus.hasNotice) });
  }

  if (subject.group) {
    return subject.group;
  }

  return subject.source === "notice" && syllabus.fromMaterial ? t("From your material") : null;
}

/** A subject's weight when the exam gives no question count, which Details shows otherwise. */
function useShareFact(subject: SyllabusSubject): string | null {
  const t = useExtracted();
  const format = useFormatter();

  if (subject.questions || subject.share === null) {
    return null;
  }

  return t("{share} of the exam", {
    share: format.number(subject.share, { maximumFractionDigits: 0, style: "percent" }),
  });
}

function SubjectFacts({
  subject,
  syllabus,
}: {
  subject: SyllabusSubject;
  syllabus: OriginSyllabus;
}) {
  const doneShare = useDoneShare();
  const origin = useOriginFact({ subject, syllabus });
  const share = useShareFact(subject);
  const known = useKnownLine()(subject);
  const alsoIn = useAlsoIn({ sharedExams: syllabus.sharedExams, sharedWith: subject.sharedWith });
  const inLessons = !subject.notPlannedReason && subject.preparation === null;

  // Topics and chapters count themselves over their lists, and Details names the questions.
  const facts = [
    origin,
    share,
    inLessons && doneShare(getSubjectShare(getSubjectBar(subject))),
  ].filter(Boolean);

  return (
    <>
      {facts.length > 0 && (
        <DetailFacts>
          <FactSegments facts={facts} />
        </DetailFacts>
      )}
      {known && <DetailFacts className="pt-0 font-sans">{known}</DetailFacts>}
      {alsoIn && <DetailFacts className="pt-0 font-sans">{alsoIn}</DetailFacts>}
    </>
  );
}

/** The subject's main action, pinned under the page: its next chapter to study. */
function SubjectBottomBar({
  chapterHref,
  subject,
}: {
  chapterHref: (chapterId: string) => string;
  subject: SyllabusSubject;
}) {
  const next = subject.chapters.find((chapter) => chapter.state !== "done" && chapter.chapterId);
  const nextId = subject.notPlannedReason ? null : (next?.chapterId ?? null);

  if (!nextId) {
    return null;
  }

  return (
    <BottomBar>
      <BottomBarActions>
        <DetailContinueLink href={chapterHref(nextId)} started={subject.lessonsDone > 0} />
      </BottomBarActions>
    </BottomBar>
  );
}

function SubjectHeader({
  subject,
  syllabus,
}: {
  subject: SyllabusSubject;
  syllabus: OriginSyllabus;
}) {
  return (
    <DetailHero>
      <DetailHeroText>
        <DetailTitle>{subject.shortName ?? subject.name}</DetailTitle>
        <SubjectFacts subject={subject} syllabus={syllabus} />
      </DetailHeroText>
    </DetailHero>
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

  return (
    <PageSection aria-labelledby={TOPICS_TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={TOPICS_TITLE_ID}>
          {fromMaterial ? t("Topics in your material") : t("Topics on the exam")}
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

      <TopicFrequencySource source={subject.topicFrequencySource} />
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
  ask?: React.ReactNode;
  hrefs: SubjectHrefs;
  subject: SyllabusSubject;
  syllabus: SubjectSyllabus;
}) {
  const t = useExtracted();

  return (
    <DetailLayout
      aside={<SubjectAside questionsSource={syllabus.questionsSource} subject={subject} />}
      asideLabel={t("About this subject")}
      bar={
        <LearnPageBar
          back={{ href: hrefs.back, label: t("Plan") }}
          title={subject.shortName ?? subject.name}
        >
          {ask}
          <ReportProblemMenu label={t("Subject options")} screen="subject" />
        </LearnPageBar>
      }
      bottomBar={<SubjectBottomBar chapterHref={hrefs.chapter} subject={subject} />}
      data-slot="subject"
    >
      <DetailAside>
        <SubjectHeader subject={subject} syllabus={syllabus} />
        <SubjectCoverage className="min-[72rem]:hidden" labelled subject={subject} />
        <NotPlannedCallout actions={actions} adjustHref={hrefs.adjust} subject={subject} />
        <SubjectWrittenPractice
          actions={actions}
          practice={syllabus.writtenPractice}
          subject={subject}
        />
      </DetailAside>

      <DetailContent>
        <SubjectChapters
          chapterHref={hrefs.chapter}
          chapters={subject.chapters}
          mindMapsHref={hrefs.mindMaps?.(subject.key) ?? null}
        />

        {subject.topics.length > 0 && (
          <TopicsSection
            chapterHref={hrefs.chapter}
            fromMaterial={syllabus.fromMaterial}
            subject={subject}
          />
        )}

        <SubjectMatrix matrix={subject.matrix} />
      </DetailContent>
    </DetailLayout>
  );
}
